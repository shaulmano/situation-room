"""Verify that open jobs at companies Shaul knows people in are still open.

A job counts as dead only on positive evidence: LinkedIn says it no longer
accepts applications, or the board redirects away / returns 404. A network
error or a block is never evidence, so such a job is simply left unchecked.

Run: python sync/liveness.py [--dry] [--max N]
"""
import os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q
from seo_jobs import posting_is_live

LEGAL = re.compile(r"(ltd|limited|inc|incorporated|llc|corp|corporation|gmbh|בעמ)$")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
CLOSED = re.compile(r"no longer accepting applications|closed-job|job is no longer available", re.I)


def key(name):
    return LEGAL.sub("", re.sub(r"[\W_]+", "", (name or "").lower()))


def linkedin_state(url):
    """returns 'closed', 'live' or None when we could not tell."""
    m = re.search(r"linkedin\.com/jobs/view/(?:.*?-)?(\d{6,})", url or "")
    if not m:
        return None
    page = "https://www.linkedin.com/jobs/view/" + m.group(1)
    out = subprocess.run(
        ["curl", "-s", "-L", "--max-time", "20", "-A", UA, "-w", "\n%{http_code}", page],
        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""
    body, _, code = out.rpartition("\n")
    if code in ("404", "410"):
        return "closed"
    if code != "200" or len(body) < 2000:
        return None
    if CLOSED.search(body):
        return "closed"
    # a real job page names the job; anything else (login wall) is not evidence
    if "top-card" in body or "show-more-less-html" in body or "topcard" in body:
        return "live"
    return None


def main():
    dry = "--dry" in sys.argv
    cap = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 200
    # חברות שיש בהן מכר, וגם כל חברות זהב בגוש דן: משרה בחברה כזאת היא מה
    # שמוקפץ בראש המסך, גם בלי מכר (שאול, 20.11: "דלת אחורית למישהו שם").
    ckeys = {r["company_key"] for r in sql(
        "select distinct company_key from contacts where company_key is not null and company_key <> '' "
        "union select distinct company_key from companies where region = 'gush_dan' and company_key <> ''")}
    jobs = sql(
        "select id, url, source, company, title, live_checked_at from jobs "
        "where on_target and dismissed_at is null and closed_at is null "
        "and first_seen > now() - interval '60 days' "
        "and (live_checked_at is null or live_checked_at < now() - interval '6 hours') "
        "order by live_checked_at nulls first, first_seen desc limit 4000")
    todo = [j for j in jobs if key(j["company"]) in ckeys][:cap]
    print("candidates %d of %d" % (len(todo), len(jobs)))
    closed = live = unknown = 0
    for j in todo:
        url = j["url"] or ""
        state = linkedin_state(url) if "linkedin.com" in url else None
        if state is None and "linkedin.com" not in url and url:
            ok, why = posting_is_live(url)
            state = "live" if ok else "closed"
            if not ok:
                print("  closed (%s): %s" % (why, j["title"]))
        if state is None:
            unknown += 1
            continue
        if state == "closed":
            closed += 1
            print("  closed: %s | %s" % (j["company"], j["title"]))
            if not dry:
                sql("update jobs set closed_at = now(), live_checked_at = now() where id = %s" % q(j["id"]))
        else:
            live += 1
            if not dry:
                sql("update jobs set live_checked_at = now() where id = %s" % q(j["id"]))
    print("checked: live %d, closed %d, unknown %d" % (live, closed, unknown))


if __name__ == "__main__":
    main()
