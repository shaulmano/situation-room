"""Verify, job by job, that an open job is really open. Three answers only.

live    : positive evidence the posting is open (an apply button on the page).
closed  : positive evidence it is closed ("No longer accepting applications",
          404/410, or the board redirects up to its root).
unknown : anything else. Rate limits (429), login walls and network errors are
          never evidence, so the job stays unverified and is retried later.

LinkedIn answers 429 to bursts, so requests are paced and a throttled run stops
early instead of guessing. Measured 20.11.2026: 123 of 200 pages came back 429
when fetched back to back, and the same pages answer when spaced out.

Run: python sync/liveness.py [--dry] [--max N] [--diag]
"""
import os, re, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q
from seo_jobs import posting_is_live, workday_api_url

LEGAL = re.compile(r"(ltd|limited|inc|incorporated|llc|corp|corporation|gmbh|בעמ)$")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
CLOSED = re.compile(r"no longer accepting applications|closed-job|job is no longer available", re.I)
APPLY = re.compile(r"apply-button|top-card-layout__cta|jobs-apply-button", re.I)
PAUSE = 3.0      # seconds between jobs
RETRY_WAIT = 25  # after a 429


def key(name):
    return LEGAL.sub("", re.sub(r"[\W_]+", "", (name or "").lower()))


def _get(url):
    out = subprocess.run(
        ["curl", "-s", "-L", "--max-time", "20", "-A", UA, "-w", "\n%{http_code}", url],
        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""
    body, _, code = out.rpartition("\n")
    return code, body


def linkedin_state(url):
    """returns ('closed'|'live'|None, throttled)"""
    m = re.search(r"linkedin\.com/jobs/view/(?:.*?-)?(\d{6,})", url or "")
    if not m:
        return None, False
    jid = m.group(1)
    throttled = False
    for attempt in range(3):
        throttled = False
        for page in ("https://www.linkedin.com/jobs/view/" + jid,
                     "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/" + jid):
            code, body = _get(page)
            if code in ("404", "410"):
                return "closed", False
            if code == "429":
                throttled = True
                continue
            if code != "200":
                continue
            if CLOSED.search(body):
                return "closed", False
            if APPLY.search(body):
                return "live", False
        if not throttled:
            return None, False
        time.sleep(RETRY_WAIT * (attempt + 1))
    return None, True


def other_state(url):
    ok, why = posting_is_live(url)
    if not ok:
        print("  closed (%s)" % why)
        return "closed"
    if why == "HTTP 200" or (why == "" and workday_api_url(url)):
        return "live"
    return None


def main():
    dry = "--dry" in sys.argv
    cap = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 150
    # חברות שיש בהן מכר, וגם כל חברות זהב בגוש דן.
    ckeys = {r["company_key"] for r in sql(
        "select distinct company_key from contacts where company_key is not null and company_key <> '' "
        "union select distinct company_key from companies where region = 'gush_dan' and company_key <> ''")}
    jobs = sql(
        "select id, url, source, company, title from jobs "
        "where on_target and closed_at is null and coalesce(url,'') <> '' "
        "and first_seen > now() - interval '60 days' "
        "and (live_checked_at is null or live_checked_at < now() - interval '24 hours') "
        "and (live_tried_at is null or live_tried_at < now() - interval '1 hour') "
        "order by live_checked_at is not null, live_tried_at nulls first, first_seen desc limit 4000")
    todo = [j for j in jobs if key(j["company"]) in ckeys][:cap]
    print("candidates %d of %d" % (len(todo), len(jobs)))
    live = closed = unknown = 0
    for n, j in enumerate(todo):
        url = j["url"] or ""
        throttled = False
        if "linkedin.com" in url:
            state, throttled = linkedin_state(url)
        else:
            state = other_state(url)
        if not dry:
            sql("update jobs set live_tried_at = now() where id = %s" % q(j["id"]))
        if state == "closed":
            closed += 1
            print("  closed: %s | %s" % (j["company"], j["title"]))
            if not dry:
                sql("update jobs set closed_at = now(), live_checked_at = now() where id = %s" % q(j["id"]))
        elif state == "live":
            live += 1
            if not dry:
                sql("update jobs set live_checked_at = now() where id = %s" % q(j["id"]))
        else:
            unknown += 1
        if throttled:
            print("throttled by LinkedIn after %d jobs, stopping this run" % (n + 1))
            break
        time.sleep(PAUSE)
    print("checked: live %d, closed %d, unknown %d" % (live, closed, unknown))


if __name__ == "__main__":
    main()
