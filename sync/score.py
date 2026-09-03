"""
Stage A of the match engine: a deterministic score, run over every job.

No language model here on purpose. This runs on everything for free and its job
is to *order* the feed, not to decide anything - the expensive pass only ever
sees what clears the threshold.

Weights (100 total) follow the spec:
  role 30 · seniority 15 · location 15 · domain 15 · org type 10 · tech 10 · fresh 5

Jobs with no description are scaled down to a CAP_NO_DESC ceiling rather than
clamped to it: a title alone cannot justify the top of the list, but every such
job landing on the identical number would be a tie instead of an order.
"""
import os, re, sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q

CAP_NO_DESC = 60
BATCH = 150

CVS = {
    "qa":       ["qa", "quality", "test", "testing", "automation", "בדיקות", "איכות"],
    "program":  ["project", "program", "pmo", "portfolio", "פרויקט", "תוכנית", "תכנית"],
    "delivery": ["release", "delivery", "deployment", "גרסאות", "שחרור"],
}

MGMT = ["manager", "director", "head of", "lead", "leader", "vp", "chief", "מנהל", "ראש צוות", "ראש.ת"]
IC = ["engineer", "developer", "analyst", "specialist", "junior", "student", "מפתח", "סטודנט"]

# Commute from Rosh HaAyin. Gush Dan and the Sharon are a short drive; Jerusalem
# is roughly an hour each way, so it scores but does not score full.
NEAR = ["גוש דן", "תל אביב", "פתח תקווה", "ראש העין", "הרצליה", "רמת גן", "השרון", "כפר סבא",
        "הוד השרון", "רעננה", "בני ברק", "חולון", "פתח־תקווה", "tel aviv", "petah", "herzliya",
        "ramat gan", "raanana", "kfar saba", "central district", "מרכז", "השפלה"]
FAR = ["ירושלים", "jerusalem", "חיפה", "haifa", "באר שבע", "beer sheva", "צפון", "דרום", "אילת"]

# The pivot: enterprise IT inside traditional organisations beats hi-tech proper.
ENTERPRISE = ["ממשלת", "ממשלתי", "בנק", "ביטוח", "עירייה", "מערכות מידע", "משרד", "ציבורי",
              "קופת", "כללית", "מכבי", "בזק", "חשמל", "רכבת", "government", "bank", "insurance",
              "municipal", "public sector", "מטריקס", "מלם", "one1", "one technologies", "טלדור",
              "malam", "matrix", "taldor", "aman", "ness", "hilan"]

TECH = ["jira", "xray", "jenkins", "ci/cd", "selenium", "agile", "scrum", "sql", "sap",
        "salesforce", "crm", "erp", "istqb", "devops", "azure", "aws", "api", "automation"]


def has(text, words):
    return any(w in text for w in words)


def count(text, words):
    return sum(1 for w in words if w in text)


def score_one(job, cv_id, cv_text):
    title = (job.get("title") or "").lower()
    desc = (job.get("description") or "").lower()
    loc = (job.get("location") or "").lower()
    company = (job.get("company") or "").lower()
    blob = " ".join([title, desc, company])
    dims, reasons, flags = {}, [], []

    # role — does the title name what this CV is for
    hits = count(title, CVS[cv_id])
    dims["role"] = 30 if hits >= 2 else 22 if hits == 1 else 0
    if dims["role"] == 0:
        flags.append("הכותרת לא תואמת את קובץ קורות החיים")

    # seniority — a mismatch is bad in both directions
    if has(title, MGMT):
        dims["seniority"] = 15
    elif has(title, IC):
        dims["seniority"] = 2
        flags.append("תפקיד ביצועי, לא ניהולי")
    else:
        dims["seniority"] = 8

    # location
    if has(loc, NEAR):
        dims["location"] = 15
        reasons.append("באזור הנסיעה")
    elif has(loc, FAR):
        dims["location"] = 6
        flags.append("מרוחק מראש העין")
    else:
        dims["location"] = 9

    # domain — anywhere in the text, not just the title
    dims["domain"] = min(15, count(blob, sum(CVS.values(), [])) * 3)

    # organisation type
    if has(blob, ENTERPRISE):
        dims["org"] = 10
        reasons.append("ארגון IT מסורתי")
    else:
        dims["org"] = 3

    # tech overlap with the CV itself
    shared = [t for t in TECH if t in blob and t in cv_text]
    dims["tech"] = min(10, len(shared) * 2)
    if shared:
        reasons.append("חפיפה: " + ", ".join(shared[:4]))

    # freshness
    dims["fresh"] = 5
    posted = job.get("posted")
    if posted:
        try:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(str(posted) + "T00:00:00+00:00")).days
            dims["fresh"] = 5 if age <= 2 else 3 if age <= 7 else 1 if age <= 30 else 0
            if age > 30:
                flags.append("פורסם לפני %d ימים" % age)
        except ValueError:
            pass

    total = sum(dims.values())
    if not desc:
        # Scale rather than clamp. A hard min() put every title-only job on
        # exactly the cap, which is a tie, not a ranking — and a ranking is the
        # only thing this stage exists to produce.
        total = round(total * CAP_NO_DESC / 100)
        flags.append("אין תיאור משרה — ניקוד לפי כותרת בלבד")
    return total, dims, reasons, flags


def main():
    cvs = {r["id"]: (r["content"] or "").lower() for r in sql("select id, content from cvs")}
    if not cvs:
        print("no CVs seeded")
        return
    jobs = sql("select id, title, company, location, posted, description from jobs")
    print("scoring %d jobs against %d CVs" % (len(jobs), len(cvs)))

    rows = []
    for job in jobs:
        for cv_id, cv_text in cvs.items():
            total, dims, reasons, flags = score_one(job, cv_id, cv_text)
            rows.append((job["id"], cv_id, total, dims, reasons, flags))

    def arr(items):
        return "array[" + ",".join(q(x) for x in items) + "]::text[]" if items else "'{}'::text[]"

    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        vals = ",".join(
            "(%s,%s,%d,'rule',%s::jsonb,%s,%s)"
            % (q(j), q(c), s,
               q(str(d).replace("'", '"')), arr(r), arr(f))
            for j, c, s, d, r, f in chunk
        )
        sql("insert into matches (job_id,cv_id,score,stage,dimensions,reasons,red_flags) "
            "values %s on conflict (job_id,cv_id) do update set score=excluded.score, "
            "dimensions=excluded.dimensions, reasons=excluded.reasons, "
            "red_flags=excluded.red_flags, scored_at=now();" % vals)
        print("  %d/%d" % (min(i + BATCH, len(rows)), len(rows)))

    top = sql("select m.score, m.cv_id, j.title, j.company, j.location from matches m "
              "join jobs j on j.id=m.job_id order by m.score desc limit 12")
    print("\ntop matches:")
    for r in top:
        print("  %3s  %-9s %-52s %s" % (r["score"], r["cv_id"], (r["title"] or "")[:52],
                                        (r["location"] or "")[:22]))


if __name__ == "__main__":
    main()
