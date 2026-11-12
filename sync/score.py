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
BATCH = 80   # smaller batches survive a flaky upstream better than one big one

CVS = {
    "qa":       ["qa", "quality", "test", "testing", "automation", "בדיקות", "איכות"],
    "program":  ["project", "program", "pmo", "portfolio", "פרויקט", "תוכנית", "תכנית"],
    "delivery": ["release", "delivery", "deployment", "גרסאות", "שחרור"],
}

def keywords_for(cv_id):
    """מילות המפתח של גרסת קורות חיים, גם כשאיש לא הגדיר אותן.

    המילון למעלה מכסה את שלוש הגרסאות הוותיקות. גרסה שנוספה מהמסך בהגדרות
    לא נמצאת בו, ובמקום להפיל את הצינור היא מנוקדת מול כל המילים, בתוספת
    המילים שבמזהה שלה עצמו. "rnd-program-manager" נותן rnd, program, manager.
    """
    if cv_id in CVS:
        return CVS[cv_id]

    # 3.11.2026: קודם הוחזרו כאן כל מילות המפתח של כל הגרסאות. זה מנע את
    # הקריסה אבל הפך את הגרסה החדשה למתאימה לכל משרה, ולכן היא ניצחה בכל
    # שורה בלוח: כל המשרות הוצגו כ-rnd-program-manager.
    #
    # עכשיו היא מקבלת רק את המילים שבשמה. "rnd-program-manager" נותן rnd
    # ו-program, בלי manager, כי בכירות נמדדת בממד נפרד והמילה הזאת היתה
    # מכניסה אותה לכל כותרת ניהולית בלי קשר לתחום.
    stop = set(MGMT) | set(IC) | {"the", "and", "for", "cvs"}
    from_id = [w for w in re.split(r"[^a-z0-9]+", (cv_id or "").lower())
               if len(w) > 2 and w not in stop]
    # בלי שום מילה שמישה, עדיף ניקוד גס על ניקוד אפס.
    return sorted(set(from_id)) or sorted(set(sum(CVS.values(), [])))


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
    #
    # 2.11.2026: המסך החדש בהגדרות מאפשר להוסיף גרסת קורות חיים, והמילון כאן
    # היה קבוע בקוד. גרסה שלא הופיעה בו הפילה את score.py ב-KeyError, ומכיוון
    # שהניקוד רץ בתוך אותו וורקפלו של הסנכרון, כל המשרות החדשות נעצרו בדרך
    # למסד. היום לא נכנסה אף משרה אחרי 12:30 בגלל זה.
    #
    # גרסה שאינה במילון מנוקדת מול כל מילות המפתח: עדיף ניקוד גס על גרסה
    # חדשה מאשר צינור שנופל. keywords_for מחזיר גם מילים מתוך שם הגרסה עצמה,
    # כך ש-rnd-program-manager תופס program ו-manager בלי שאיש יגדיר כלום.
    hits = count(title, keywords_for(cv_id))
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
    # גרסה לא פעילה נשארת במסד כהיסטוריה של ההגשות שיצאו איתה, אבל לא
    # מנקדת יותר. בלי התנאי הזה "הורדת גרסה" הייתה מחיקה של המידע
    # איזה קורות חיים נשלחו לכל חברה.
    cvs = {r["id"]: (r["content"] or "").lower()
           for r in sql("select id, content from cvs where active")}
    if not cvs:
        print("no CVs seeded")
        return
    # ‏12.11.2026. עד היום השורה הזאת הייתה select בלי שום תנאי, כלומר כל
    # ריצה ניקדה מחדש את כל הטבלה: 3,642 משרות כפול חמש גרסאות, כ-18,000
    # שורות שנכתבו מחדש, כמה פעמים ביום, כל יום. רובן המוחלט אותה משרה מול
    # אותה גרסה עם אותו ציון בדיוק.
    #
    # זה מה שכילה את תקציב ה-Disk IO של הפרויקט ב-12.11.2026 והשאיר את
    # המסכים ריקים בלי שום שגיאה. שאול: "לא הגיוני לרוץ על הכל".
    #
    # שלושה מצבים:
    #   (ברירת מחדל)  רק צמדים שחסרה להם שורת התאמה. משרה חדשה, או גרסת
    #                 קורות חיים חדשה שעוד לא נוקדה מול כלום.
    #   open          כל המשרות הפתוחות שעל המטרה ולא נפסלו. זה מה שמריצים
    #                 כשתוכן של גרסה קיימת השתנה.
    #   all           הכל. בנייה מחדש, ידנית בלבד.
    mode = sys.argv[1] if len(sys.argv) > 1 else "missing"
    cols = "id, title, company, location, posted, description"
    if mode == "all":
        jobs = sql("select %s from jobs" % cols)
    elif mode == "open":
        jobs = sql("select %s from jobs where on_target and dismissed_at is null" % cols)
    else:
        mode = "missing"
        jobs = sql(
            "select %s from jobs j where (select count(*) from matches m "
            "where m.job_id = j.id) < %d" % (cols.replace("id,", "j.id,"), len(cvs)))
    print("mode=%s: scoring %d jobs against %d CVs" % (mode, len(jobs), len(cvs)))
    if not jobs:
        print("nothing to score")
        return

    # שגיאה על צמד אחד לא מפילה את כל המעבר.
    #
    # 2.11.2026: גרסת קורות חיים חדשה הפילה את כל הניקוד ב-KeyError, והניקוד
    # רץ בתוך הוורקפלו של הסנכרון. התוצאה: המשרות כן נכנסו למסד, אבל בלי
    # שורת התאמה, והמסכים מצרפים jobs ל-matches ולכן הן היו בלתי נראות.
    # משרה בלי התאמה היא משרה שלא קיימת מבחינת שאול, וזה קרה בלי שום שגיאה
    # על המסך.
    #
    # לכן: כל צמד נתפס בנפרד, הספירה נרשמת, ובסוף נכשלים בקול רק אם חלק גדול
    # נפל. ככה תקלה בגרסה אחת עולה את הגרסה הזאת, לא את כל הלוח.
    rows, failures, first_error = [], 0, None
    for job in jobs:
        for cv_id, cv_text in cvs.items():
            try:
                total, dims, reasons, flags = score_one(job, cv_id, cv_text)
            except Exception as e:
                failures += 1
                if first_error is None:
                    first_error = "%s/%s: %s" % (job.get("id"), cv_id, e)
                continue
            rows.append((job["id"], cv_id, total, dims, reasons, flags))

    if failures:
        print("WARNING: %d of %d pairs failed to score. First: %s"
              % (failures, failures + len(rows), first_error))
        if failures > (failures + len(rows)) * 0.2:
            raise SystemExit(
                "more than a fifth of the pairs failed to score - refusing to "
                "write a partial ranking: %s" % first_error)

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

    # הדוח הזה מצרף את כל טבלת ההתאמות וממיין אותה. בריצה רגילה, שמנקדת
    # כמה משרות חדשות, אין בו שום ערך והוא רק עוד קריאה.
    if mode == "missing":
        return
    top = sql("select m.score, m.cv_id, j.title, j.company, j.location from matches m "
              "join jobs j on j.id=m.job_id order by m.score desc limit 12")
    print("\ntop matches:")
    for r in top:
        print("  %3s  %-9s %-52s %s" % (r["score"], r["cv_id"], (r["title"] or "")[:52],
                                        (r["location"] or "")[:22]))


if __name__ == "__main__":
    main()
