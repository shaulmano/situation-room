"""
Push the job-search bot's findings into the situation room.

Accepts a path or an https url. The url form is how the scheduled sync works:
the bot already scrapes every 90 minutes and commits jobs.jsonl to its public
repo, so this fetches that file instead of scraping everything a second time -
half a minute and no browser, against fifteen minutes and a Chromium install.
It also means the Supabase token stays out of the public repo.

The bot writes every reported job to jobs.jsonl in the (public) job-search repo.
That file is market data - what exists out there - so it is safe to mirror here.
What is NOT mirrored: recruiter names and urls. Those name real people who never
agreed to be catalogued, and they stay out of this database exactly as they are
being taken out of the public repo.

Run: python sync/jobs_sync.py [path-to-jobs.jsonl]
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q  # same Management API path, same reasoning
import searches as sr

DEFAULT = os.path.expanduser("~/Documents/job-search/jobs.jsonl")
BATCH = 200

# Mirrors _RELEVANT_TITLE_RE / _is_mgmt in the bot, kept deliberately loose here:
# the bot already gated these rows, this is only a hint for the jobs screen.
ON_TARGET = (
    "qa", "quality", "test", "release", "delivery",
    "program", "project", "pmo", "בדיקות", "איכות", "פרויקט", "תוכנית",
)


def read_lines(src):
    if src.startswith("http"):
        import urllib.request
        req = urllib.request.Request(src, headers={"User-Agent": "situation-room-sync"})
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read().decode("utf-8").splitlines()
    with open(src, encoding="utf-8") as fh:
        return fh.readlines()


def rows(path):
    seen = set()
    if True:
        for line in read_lines(path):
            line = line.strip()
            if not line:
                continue
            try:
                j = json.loads(line)
            except ValueError:
                continue
            jid = j.get("id")
            if not jid or jid in seen:
                continue
            seen.add(jid)
            title = (j.get("title") or "").strip()
            if not title:
                continue
            yield {
                "id": jid,
                "title": title[:200],
                "company": (j.get("company") or "")[:120] or None,
                "source": j.get("source") or "unknown",
                "url": j.get("url") or None,
                "location": (j.get("location") or "")[:120] or None,
                "posted": j.get("posted") or None,
                "first_seen": j.get("first_seen") or None,
                "last_seen": j.get("last_seen") or None,
                "on_target": any(k in title.lower() for k in ON_TARGET),
            }


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    if not path.startswith("http") and not os.path.exists(path):
        print("no such file: %s" % path)
        return
    all_rows = list(rows(path))
    print("parsed %d unique jobs from %s" % (len(all_rows), path.rsplit("/", 1)[-1]))

    total = 0
    for i in range(0, len(all_rows), BATCH):
        chunk = all_rows[i:i + BATCH]
        vals = ",".join(
            "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
            % (q(r["id"]), q(r["title"]), q(r["company"]), q(r["source"]), q(r["url"]),
               q(r["location"]), q(r["posted"]), q(r["first_seen"]), q(r["last_seen"]),
               "true" if r["on_target"] else "false")
            for r in chunk
        )
        sql(
            # Conflict on the url, not the id. jobs.jsonl and the live scan give
            # the same posting different ids, and the url is what identifies it.
            "insert into jobs "
            "(id,title,company,source,url,location,posted,first_seen,last_seen,on_target) "
            "values %s on conflict (url) do update set title=excluded.title, "
            "company=excluded.company, location=excluded.location, "
            "posted=excluded.posted, last_seen=excluded.last_seen, "
            "on_target=excluded.on_target;" % vals
        )
        total += len(chunk)
        print("  upserted %d/%d" % (total, len(all_rows)))

    # Link what arrived to the searches it answers. Every screen joins
    # search_matches, so a posting written without a row here is invisible
    # however well it fits - the trap the scan already fell into once, with
    # thirty Malam and SQLink jobs sitting on target and showing nowhere.
    searches = sr.active()
    if searches:
        # By url, not by the id in the file: the upsert conflicts on url, so a
        # posting already in the table kept the id it already had. Linking to
        # the file's id would fail the foreign key on every job seen before -
        # which is most of them, since the file is cumulative.
        urls = [r["url"] for r in all_rows if r["url"]]
        saved = []
        for i in range(0, len(urls), 200):
            vals = ",".join(q(u) for u in urls[i:i + 200])
            saved += sql("select id, title from jobs where url in (%s)" % vals)
        per = sr.write_matches(searches, saved)
        by_id = {s["id"]: s["label"] for s in searches}
        print("\nlinked to searches:")
        for sid, n in sorted(per.items(), key=lambda kv: -kv[1]):
            print("  %-5d %s" % (n, by_id.get(sid, sid)))

    out = sql("select source, count(*)::text as n from jobs group by source order by count(*) desc")
    print("\njobs by source:")
    for r in out:
        print("  %-14s %s" % (r["source"], r["n"]))


if __name__ == "__main__":
    main()
