"""
Run every scheduled scraper and record what each one actually produced.

This is what fills the Sources screen. It reuses the bot's own scrapers and its
own gates - lifted out of job_server.py rather than copied, so they cannot drift
apart - and writes one `scans` row per source per run: raw, on target, and how
many of those were new.

Each source is written the moment it finishes rather than all of them at the
end, so the progress bar counts real work instead of animating. A run that dies
halfway leaves the sources it did finish on the screen.

It also saves the postings, not only the tally. Counting "50 on target at
AllJobs" and then dropping the fifty is how the sources screen came to disagree
with the jobs screen: the counts were real and the jobs behind them were never
written anywhere.

The point of the screen is to answer one question honestly: which source is
earning its runtime. A source that returns thousands of rows and nothing on
target is noise, and the row will say so.
"""
import hashlib, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q
import searches as sr

BOT = os.environ.get("BOT_DIR") or os.path.expanduser("~/Documents/job-search")
sys.path.insert(0, BOT)


def load():
    os.chdir(BOT)
    import job_server as js
    import audit_sources as au
    return js, au


def start_run(total):
    rows = sql(
        "insert into scan_runs (total, done, status) values (%d, 0, 'running') "
        "returning id;" % total
    )
    return rows[0]["id"]


def finish_run(run_id, done, status="done", note=None):
    sql(
        "update scan_runs set finished_at = now(), done = %d, status = %s, note = %s "
        "where id = %s;" % (done, q(status), q(note), q(run_id))
    )


def record(run_id, src, raw, on_target, uniq, failed, reason, done):
    sql(
        "insert into scans (run_id, ran_at, source, raw, on_target, fresh, failed, reason) "
        "values (%s, now(), %s, %d, %d, %d, %s, %s);"
        % (q(run_id), q(src), raw, on_target, uniq, "true" if failed else "false", q(reason))
    )
    sql("update scan_runs set done = %d where id = %s;" % (done, q(run_id)))


def job_id(url):
    """Only used for rows this scan creates; the url is what identifies a job."""
    return "sc-" + hashlib.sha1(url.encode("utf-8")).hexdigest()[:14]


def save_jobs(jobs):
    """Upsert the on-target postings themselves — counting them is not enough."""
    if not jobs:
        return
    for i in range(0, len(jobs), 100):
        chunk = jobs[i:i + 100]
        vals = ",".join(
            "(%s,%s,%s,%s,%s,%s,%s,now(),now(),true)"
            % (q(job_id(j["url"])), q(j["title"][:200]), q(j.get("company") or None),
               q(j.get("source") or "unknown"), q(j["url"]),
               q((j.get("location") or "")[:120] or None),
               q((j.get("description") or "")[:3000] or None))
            for j in chunk
        )
        sql(
            # on the url, not the id: the bot's file and this scan give the same
            # posting two different ids, which is how 108 duplicates appeared.
            "insert into jobs "
            "(id,title,company,source,url,location,description,first_seen,last_seen,on_target) "
            "values %s on conflict (url) do update set "
            "title=excluded.title, company=excluded.company, "
            "location=excluded.location, "
            "description=coalesce(excluded.description, jobs.description), "
            "last_seen=now(), on_target=true;" % vals
        )


def scan_one(js, au, src, roles, searches):
    """Returns (raw, on_target_jobs, unique, failed, reason)."""
    fn = js.SCRAPERS.get(src)
    if not fn:
        return 0, [], 0, True, "no scraper registered"

    raw, seen_urls = 0, set()
    on_target = {}
    failed, reason = False, None

    for role in roles:
        try:
            found = fn(role) or []
        except Exception as e:
            failed, reason = True, "%s: %s" % (type(e).__name__, str(e)[:120])
            continue
        raw += len(found)
        for j in found:
            url = j.get("url") or ""
            title = j.get("title") or ""
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            low = (title + " " + (j.get("company") or "")).lower()
            # _BAD stays: it is a junk filter - reposted spam, "עבודה מהבית",
            # pyramid schemes - and junk is junk whatever anyone is looking for.
            if any(k in low for k in au._BAD):
                continue
            # What replaced _IS_MGMT, _RELEVANT_TITLE_RE and _NONTECH: those
            # three encoded one person's search into the pipeline, so a posting
            # nobody here had asked for was dropped before it could ever reach
            # anybody. A posting is on target now if it answers *someone's*
            # active search - and if it answers none, nobody wanted it.
            if not any(sr.matches(s.get("rule"), title) for s in searches):
                continue
            on_target[url] = j

    if raw == 0 and not failed:
        failed, reason = True, "returned nothing"
    elif not on_target and not failed:
        reason = "nothing on target"
    return raw, list(on_target.values()), len(seen_urls), failed, reason


def main():
    js, au = load()
    only = [a for a in sys.argv[1:] if not a.startswith("-")] or js.SCHEDULED_SOURCES

    searches = sr.active()
    # Rotate the shopping list between runs so a term that sits past the cap is
    # asked a few times a day rather than never.
    offset = int(sql("select count(*)::int as n from scan_runs")[0]["n"]) if searches else 0
    roles = sr.query_terms(searches, offset)

    # Before anyone has defined a search there is nothing to ask for, and an
    # empty list would scan twelve sources for nothing and write a run that
    # looks like every source failed. The old hardcoded roles are the floor.
    if not roles:
        roles = js.SCHEDULED_ROLES
        print("no active searches - falling back to the built-in roles", flush=True)

    print("sources: %s" % ", ".join(only), flush=True)
    print("terms  : %s" % " · ".join(roles), flush=True)
    print("searches: %d active" % len(searches), flush=True)

    run_id = start_run(len(only))
    print("run %s" % run_id, flush=True)

    done, saved = 0, set()
    try:
        for src in only:
            t0 = time.time()
            raw, found, uniq, failed, reason = scan_one(js, au, src, roles, searches)
            save_jobs(found)
            # The url, not the id we would have generated: the upsert conflicts
            # on url, so a posting already in the table keeps the id it already
            # had. Linking to a guessed id would fail the foreign key, and on a
            # posting that was already known - the common case.
            saved.update(j["url"] for j in found)
            done += 1
            record(run_id, src, raw, len(found), uniq, failed, reason, done)
            print("  %-12s raw=%-6d on_target=%-4d unique=%-5d %ds %s"
                  % (src, raw, len(found), uniq, round(time.time() - t0), reason or ""),
                  flush=True)
    except Exception as e:
        finish_run(run_id, done, "failed", "%s: %s" % (type(e).__name__, str(e)[:160]))
        raise

    # A scan links what it saved, in the same run. Counting a posting and then
    # leaving it unlinked is how thirty Malam and SQLink jobs once sat in the
    # table, on target and undismissed, and showed on no screen at all.
    if saved and searches:
        urls = list(saved)
        rows = []
        for i in range(0, len(urls), 200):
            vals = ",".join(q(u) for u in urls[i:i + 200])
            rows += sql("select id, title from jobs where url in (%s)" % vals)
        per = sr.write_matches(searches, rows)
        by_id = {s["id"]: s["label"] for s in searches}
        for sid, n in sorted(per.items(), key=lambda kv: -kv[1]):
            print("  linked %-4d → %s" % (n, by_id.get(sid, sid)), flush=True)

    finish_run(run_id, done)
    print("\nwrote %d scan rows" % done, flush=True)


if __name__ == "__main__":
    main()
