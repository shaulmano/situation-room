"""הצד של GitHub בפניות דרך מכרים.

‏12.11.2026. מדידה: 540 הגשות קרות הביאו 22 פתיחות ושתי שיחות, ובאותו זמן
מאות מהמשרות הפתוחות הן בחברה ששאול מכיר בה מישהו. שאול ביקש לסמן אנשי
קשר במסך אחד ושהשליחה תקרה מאחורי הקלעים, עם קובץ קורות חיים מצורף.

שתי פקודות, ושתיהן נקראות מתוך .github/workflows/cv.yml:

    python sync/referrals.py fetch
        מדפיס את השורה הבאה שמחכה לפעולה, עם הנמען, הנושא, גוף ההודעה,
        וה-PDF אם הוא כבר מוכן. קלוד קורא את זה מיומן הריצה ושולח בג'ימייל.

    python sync/referrals.py mark <id> <status> [note]
        מעדכן שורה אחרי שליחה. אין כאן שום מעבר אוטומטי מ-test_sent
        ל-sent: רק שאול מאשר, מהמסך.

הכלל שגובר על הכל: עותק בדיקה אליו קודם, ושליחה לנמען האמיתי רק אחרי
שהוא לחץ "אשר". הקובץ הזה לא מעביר שום שורה לאישור בעצמו.
"""
import base64
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cv_requests import sql, q, summary

OWNER = "shaul.mano@gmail.com"

# כמה פניות אמיתיות בריצה אחת. פנייה היא מייל אישי, לא דיוור, ושאול ביקש
# במפורש שלא יצאו מאות הודעות זהות. גם מכסת ההשלמה של כתובות היא כחמש עשרה
# בשבוע, ולכן אין בכלל נפח שמצדיק יותר.
MAX_PER_RUN = 5


def fetch():
    """מה מחכה לפעולה: קודם עותקי בדיקה, אחר כך מה ששאול כבר אישר."""
    rows = sql(
        "select r.id, r.status, r.channel, r.subject, r.body, r.cv_id, "
        "       r.pdf_base64 is not null as has_pdf, r.filename, "
        "       c.full_name, c.email, j.title, j.company, j.id as job_id "
        "from referrals r "
        "join contacts c on c.id = r.contact_id "
        "join jobs j on j.id = r.job_id "
        "where r.status in ('pending','approved') and r.channel = 'email' "
        "order by case r.status when 'approved' then 0 else 1 end, r.id "
        "limit %d;" % MAX_PER_RUN
    )
    summary("PENDING: %d" % len(rows))
    if not rows:
        return

    for r in rows:
        # הקובץ מגיע מצינור קורות החיים שכבר קיים. אם הוא עוד לא מוכן,
        # לא שולחים: שאול ביקש קובץ לפי המשרה ולא קובץ גנרי.
        if not r["has_pdf"]:
            cv = sql(
                "select pdf_base64, filename from cv_requests "
                "where job_id = %s and pdf_base64 is not null "
                "order by id desc limit 1;" % q(r["job_id"])
            )
            if cv:
                sql("update referrals set pdf_base64 = %s, filename = %s "
                    "where id = %d;"
                    % (q(cv[0]["pdf_base64"]), q(cv[0]["filename"]), r["id"]))
                r["has_pdf"] = True
                r["filename"] = cv[0]["filename"]

        summary("")
        summary("--- REFERRAL %d ---" % r["id"])
        summary("STATUS: %s" % r["status"])
        # עותק בדיקה הולך לשאול עצמו. רק שורה שהוא אישר הולכת החוצה.
        summary("SEND_TO: %s" % (r["email"] if r["status"] == "approved" else OWNER))
        summary("REAL_RECIPIENT: %s" % r["email"])
        summary("CONTACT: %s" % r["full_name"])
        summary("COMPANY: %s" % r["company"])
        summary("JOB: %s" % r["title"])
        prefix = "" if r["status"] == "approved" else "[בדיקה] "
        summary("SUBJECT: %s%s" % (prefix, r["subject"] or ""))
        summary("CV_READY: %s" % ("yes" if r["has_pdf"] else "no, skip this one"))
        summary("FILENAME: %s" % (r["filename"] or ""))
        summary("BODY:")
        for line in (r["body"] or "").splitlines():
            summary("  " + line)

    # ה-PDF עצמו לא מודפס ליומן: הוא מאות אלפי תווים. הוא נשלף בנפרד.
    summary("")
    summary("the attachment itself: python sync/referrals.py pdf <id>")


def pdf(ref_id):
    """כותב את ה-PDF לקובץ מקומי, כדי שאפשר יהיה לצרף אותו למייל."""
    rows = sql("select pdf_base64, filename from referrals where id = %d;" % int(ref_id))
    if not rows or not rows[0]["pdf_base64"]:
        summary("no pdf on referral %s" % ref_id)
        raise SystemExit(1)
    name = rows[0]["filename"] or "Shaul_Mano.pdf"
    with open(name, "wb") as fh:
        fh.write(base64.b64decode(rows[0]["pdf_base64"]))
    summary("wrote %s" % name)
    print(name)


def mark(ref_id, status, note=""):
    allowed = {"test_sent", "sent", "failed", "canceled"}
    if status not in allowed:
        raise SystemExit("status must be one of: %s" % ", ".join(sorted(allowed)))

    stamp = {"test_sent": "test_at", "sent": "sent_at"}.get(status)
    sets = ["status = %s" % q(status)]
    if stamp:
        sets.append("%s = now()" % stamp)
    if note:
        sets.append("note = %s" % q(note[:500]))
    sql("update referrals set %s where id = %d;" % (", ".join(sets), int(ref_id)))

    # פנייה שיצאה מסמנת את איש הקשר, כדי שהמסך לא יציע אותו שוב.
    if status == "sent":
        sql("update contacts set contacted_at = now() "
            "where id = (select contact_id from referrals where id = %d);" % int(ref_id))
    summary("referral %s -> %s" % (ref_id, status))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "fetch"
    if mode == "fetch":
        fetch()
    elif mode == "pdf":
        pdf(sys.argv[2])
    elif mode == "mark":
        mark(sys.argv[2], sys.argv[3], " ".join(sys.argv[4:]))
    else:
        raise SystemExit("usage: referrals.py fetch | pdf <id> | mark <id> <status> [note]")
