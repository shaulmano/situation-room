"""
Run every scheduled scraper and record what each one actually produced.

This is what fills the Sources screen. It reuses the bot's own scrapers and its
own gates - lifted out of job_server.py rather than copied, so they cannot drift
apart - and writes one `scans` row per source per run: raw, on target, and how
many of those were new.

The point of the screen is to answer one question honestly: which source is
earning its runtime. A source that returns thousands of rows and nothing on
target is noise, and the row will say so.
"""
import os, sys, time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q

BOT = os.path.expanduser("~/Documents/job-search")
sys.path.insert(0, BOT)


def load():
    os.chdir(BOT)
    import job_server as js
    import audit_sources as au
    return js, au


def main():
    js, au = load()
    roles = js.SCHEDULED_ROLES
    sources = js.SCHEDULED_SOURCES
    only = sys.argv[1:] or sources
    print("sources: %s" % ", ".join(only))

    ran_at = datetime.now(timezone.utc).isoformat()
    rows = []

    for src in only:
        fn = js.SCRAPERS.get(src)
        if not fn:
            rows.append((src, 0, 0, 0, True, "no scraper registered"))
            continue
        raw, seen_urls, on_target = 0, set(), set()
        failed, reason = False, None
        t0 = time.time()
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
                if not au._IS_MGMT(title):
                    continue
                if any(k in low for k in au._BAD):
                    continue
                if not js._RELEVANT_TITLE_RE.search(title):
                    continue
                if any(k in low for k in au._NONTECH):
                    continue
                on_target.add(url)
        if raw == 0 and not failed:
            failed, reason = True, "returned nothing"
        elif not on_target and not failed:
            reason = "nothing on target"
        secs = round(time.time() - t0)
        print("  %-12s raw=%-6d on_target=%-4d unique=%-5d %ds %s"
              % (src, raw, len(on_target), len(seen_urls), secs, reason or ""))
        rows.append((src, raw, len(on_target), len(seen_urls), failed, reason))

    vals = ",".join(
        "(%s,%s,%d,%d,%d,%s,%s)"
        % (q(ran_at), q(s), raw, ont, uniq, "true" if f else "false", q(r))
        for s, raw, ont, uniq, f, r in rows
    )
    sql("insert into scans (ran_at,source,raw,on_target,fresh,failed,reason) values %s;" % vals)
    print("\nwrote %d scan rows" % len(rows))


if __name__ == "__main__":
    main()
