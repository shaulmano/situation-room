"""
Fetch the poster of a LinkedIn job, for jobs Shaul has already applied to.

Why this exists even though the scan already fetches posters:
the bot enriches only the first _LINKEDIN_ENRICH_CAP (20) results of each
search, out of up to five pages. A job ranked 21st in its search never had its
poster looked up, and that is pure luck of the draw - it says nothing about
whether Shaul applied to it. Measured 13.11.2026: 111 posters out of 542
LinkedIn rows, about one in five.

So this runs the other way round: one request per job he actually applied to,
instead of twenty speculative requests per search. That is both cheaper and
better aimed, and it is the only path that can reach a job he applied to today
that was scanned last week.

No backfill of the history, by his instruction - only applications from the
last few days.

Stdlib only, deliberately, same as unsee.py: this has to run on a bare runner.

Run: python sync/poster.py            # applications from the last 7 days
     python sync/poster.py <job_id>   # one job, right after he marks it
"""
import os, re, sys, time, urllib.request
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q

MAX_PER_RUN = 25
RECENT_DAYS = 7
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
JOB_ID_RE = re.compile(r"(\d{7,})/?$")


class RecruiterParser(HTMLParser):
    """Finds the <a href*="linkedin.com/in/"> inside .message-the-recruiter.

    Written against the DOM and not against a regex over the markup: the lesson
    from audit_sources.py, 9.11.2026, is that pattern-matching structure you do
    not control breaks silently the next time someone moves a line.
    """

    def __init__(self):
        super().__init__()
        self.depth = 0          # >0 while inside the recruiter block
        self.in_link = False
        self.name = ""
        self.url = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.depth:
            self.depth += 1
            if tag == "a" and not self.url and "linkedin.com/in/" in (a.get("href") or ""):
                self.url = (a.get("href") or "").split("?")[0]
                self.in_link = True
        elif "message-the-recruiter" in (a.get("class") or ""):
            self.depth = 1

    def handle_endtag(self, tag):
        if self.in_link and tag == "a":
            self.in_link = False
        if self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.in_link:
            self.name += data


def fetch(url):
    m = JOB_ID_RE.search((url or "").rstrip("/"))
    if not m:
        return None, None
    api = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/%s" % m.group(1)
    try:
        req = urllib.request.Request(api, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode("utf-8", "replace")
    except Exception as e:
        print("  fetch failed: %s" % e)
        return None, None
    p = RecruiterParser()
    try:
        p.feed(html)
    except Exception:
        pass
    name = " ".join(p.name.split())[:120]
    return (name or None), (p.url[:300] or None)


def targets(job_id=None):
    if job_id:
        return sql("select id, url, title from jobs where id = %s "
                   "and coalesce(recruiter_name,'') = ''" % q(job_id))
    # Only what he applied to, and only recently. A poster is worth a request
    # because he is going to write to that person, not because the row exists.
    return sql(
        "select j.id, j.url, j.title from jobs j "
        "join applications a on a.job_id = j.id "
        "where j.source = 'LinkedIn' and coalesce(j.recruiter_name,'') = '' "
        "and coalesce(j.url,'') <> '' "
        "and a.sent_at > now() - interval '%d days' "
        "order by a.sent_at desc limit %d" % (RECENT_DAYS, MAX_PER_RUN))


def main():
    job_id = sys.argv[1] if len(sys.argv) > 1 else None
    rows = targets(job_id) or []
    print("looking up %d job(s)" % len(rows))
    found = 0
    for i, r in enumerate(rows):
        # 13.11.2026: בריצה הראשונה שתיים מתוך 25 חזרו 429. שתי שניות בין
        # בקשות עולות פחות מדקה לריצה שלמה, והן ההבדל בין "אין מפרסם" לבין
        # "לינקדאין חסמה", שתי מסקנות הפוכות שנראות אותו דבר על המסך.
        if i:
            time.sleep(2)
        name, url = fetch(r["url"])
        if not name:
            print("  no poster: %s" % (r["title"] or r["id"])[:60])
            continue
        # coalesce, not assignment: never overwrite a poster already stored.
        sql("update jobs set recruiter_name = coalesce(recruiter_name, %s), "
            "recruiter_url = coalesce(recruiter_url, %s) where id = %s"
            % (q(name), q(url), q(r["id"])))
        found += 1
        print("  %s -> %s" % ((r["title"] or r["id"])[:50], name))
    print("stored %d of %d" % (found, len(rows)))


if __name__ == "__main__":
    main()
