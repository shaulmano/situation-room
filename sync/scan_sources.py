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
    """Stable id from the url, so re-scanning the same posting updates one row."""
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
            "insert into jobs "
            "(id,title,company,source,url,location,description,first_seen,last_seen,on_target) "
            "values %s on conflict (id) do update set "
            "title=excluded.title, company=excluded.company, url=excluded.url, "
            "location=excluded.location, "
            "description=coalesce(excluded.description, jobs.description), "
            "last_seen=now(), on_target=true;" % vals
        )


def scan_one(js, au, src):
    """Returns (raw, on_target_jobs, unique, failed, reason)."""
    fn = js.SCRAPERS.get(src)
    if not fn:
        return 0, [], 0, True, "no scraper registered"

    raw, seen_urls = 0, set()
    on_target = {}
    failed, reason = False, None

    for role in js.SCHEDULED_ROLES:
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
            if not au._IS_MGMT(title):
                continue
            if any(k in low for k in au._BAD):
                continue
            if not js._RELEVANT_TITLE_RE.search(title):
                continue
            if any(k in low for k in au._NONTECH):
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
    print("sources: %s" % ", ".join(only), flush=True)

    run_id = start_run(len(only))
    print("run %s" % run_id, flush=True)

    done = 0
    try:
        for src in only:
            t0 = time.time()
            raw, found, uniq, failed, reason = scan_one(js, au, src)
            save_jobs(found)
            done += 1
            record(run_id, src, raw, len(found), uniq, failed, reason, done)
            print("  %-12s raw=%-6d on_target=%-4d unique=%-5d %ds %s"
                  % (src, raw, len(found), uniq, round(time.time() - t0), reason or ""),
                  flush=True)
    except Exception as e:
        finish_run(run_id, done, "failed", "%s: %s" % (type(e).__name__, str(e)[:160]))
        raise
    finish_run(run_id, done)
    print("\nwrote %d scan rows" % done, flush=True)


if __name__ == "__main__":
    main()
