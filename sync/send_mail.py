"""שליחת פנייה אמיתית, ישירות מהג'ימייל של שאול.

‏13.11.2026. עד היום כפתור "שלח" במסך רק סימן את השורה כמאושרת, והמייל
יצא מהמשימה המתוזמנת עד שעה אחר כך. שאול: "הכפתור של שלח לא ממש עושה
את העבודה".

שתי דרישות שלו, ושתיהן נענות בשליחה דרך smtp.gmail.com עם סיסמת
אפליקציה:
  - המייל יוצא מהחשבון הפרטי שלו ולא מכתובת של מערכת.
  - הוא רואה אותו ב-Sent, "על מנת להבין ולראות שהמייל נשלח".

ג'ימייל שומר עותק ב"נשלחו" לבד כשהשליחה היא ב-SMTP של ג'ימייל עצמו,
אבל זה לא מובטח בכל מצב, ולכן הסקריפט כותב את ההודעה ל-Sent ב-IMAP
בעצמו כשזה לא קרה. בלי זה הדרישה השנייה תלויה בהתנהגות שאין לנו
שליטה עליה.

    python sync/send_mail.py selftest
        שולח מייל בדיקה לשאול עצמו. זה מה שמריצים אחרי שמכניסים את
        הסודות, לפני שנוגעים בפנייה אמיתית.

    python sync/send_mail.py referrals
        שולח כל פנייה שסטטוסה approved, כלומר כזאת ששאול לחץ עליה
        "שלח" במסך אחרי שקרא את ההודעה ואת הקובץ.

אין כאן שום מעבר אוטומטי מ-pending ל-approved. רק שאול מאשר, מהמסך.
"""
import base64
import email.utils
import imaplib
import os
import smtplib
import sys
import time
from email.message import EmailMessage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cv_requests import sql, q, summary

OWNER = "shaul.mano@gmail.com"

# כמה פניות אמיתיות בריצה אחת. פנייה היא מייל אישי, לא דיוור.
MAX_PER_RUN = 10


def creds():
    addr = os.environ.get("GMAIL_ADDRESS", "").strip()
    app = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not addr or not app:
        summary("GMAIL_ADDRESS or GMAIL_APP_PASSWORD is missing")
        raise SystemExit(1)
    return addr, app


def build(to_addr, subject, body, pdf_b64=None, filename=None, sender=None):
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid()
    msg.set_content(body)
    if pdf_b64:
        msg.add_attachment(base64.b64decode(pdf_b64), maintype="application",
                           subtype="pdf", filename=filename or "cv.pdf")
    return msg


def deliver(msg, addr, app):
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=60) as s:
        s.login(addr, app)
        s.send_message(msg)

    # ג'ימייל בדרך כלל שם עותק ב"נשלחו" לבד. בודקים, ורק אם הוא לא שם,
    # כותבים אותו ב-IMAP. כפילות ב-Sent גרועה כמעט כמו היעדר.
    time.sleep(4)
    try:
        M = imaplib.IMAP4_SSL("imap.gmail.com")
        M.login(addr, app)
        M.select('"[Gmail]/Sent Mail"')
        mid = msg["Message-ID"].strip("<>")
        typ, data = M.search(None, 'HEADER', 'Message-ID', mid)
        found = bool(data and data[0].split())
        if not found:
            M.append('"[Gmail]/Sent Mail"', '\\Seen',
                     imaplib.Time2Internaldate(time.time()), msg.as_bytes())
            summary("  copied to Sent over IMAP")
        else:
            summary("  Gmail saved it to Sent on its own")
        M.logout()
        return True
    except Exception as exc:                      # noqa: BLE001
        summary("  could not verify Sent: %s" % exc)
        return False


def selftest():
    addr, app = creds()
    body = ("This is a self test from the situation room.\n\n"
            "If you can see this message in your inbox and also in Sent, "
            "the direct send path works.\n")
    msg = build(OWNER, "Situation room: send path self test", body, sender=addr)
    deliver(msg, addr, app)
    summary("SELFTEST SENT from %s to %s" % (addr, OWNER))


def referrals():
    addr, app = creds()
    rows = sql(
        "select r.id, r.subject, r.body, r.filename, r.pdf_base64, r.job_id, "
        "       c.full_name, c.email "
        "from referrals r join contacts c on c.id = r.contact_id "
        "where r.status = 'approved' and r.channel = 'email' "
        "order by r.approved_at nulls last, r.id limit %d;" % MAX_PER_RUN)

    summary("APPROVED: %d" % len(rows))
    for r in rows:
        to_addr = (r.get("email") or "").strip()
        if not to_addr:
            sql("update referrals set status='failed', note='no email' where id=%d;" % r["id"])
            summary("  %d skipped: no address" % r["id"])
            continue

        b64, name = r.get("pdf_base64"), r.get("filename")
        if not b64:
            cv = sql("select pdf_base64, filename from cv_requests "
                     "where job_id = %s and pdf_base64 is not null "
                     "order by id desc limit 1;" % q(r["job_id"]))
            if cv:
                b64, name = cv[0]["pdf_base64"], cv[0]["filename"]
        if not b64:
            summary("  %d skipped: the CV is not ready" % r["id"])
            continue

        try:
            msg = build(to_addr, r.get("subject") or "", r.get("body") or "",
                        b64, name, sender=addr)
            deliver(msg, addr, app)
        except Exception as exc:                  # noqa: BLE001
            sql("update referrals set status='failed', note=%s where id=%d;"
                % (q(str(exc)[:400]), r["id"]))
            summary("  %d FAILED: %s" % (r["id"], exc))
            continue

        sql("update referrals set status='sent', sent_at=now(), "
            "pdf_base64=coalesce(pdf_base64,%s), filename=coalesce(filename,%s) "
            "where id=%d;" % (q(b64), q(name or ""), r["id"]))
        sql("update contacts set contacted_at=now() where id="
            "(select contact_id from referrals where id=%d);" % r["id"])
        summary("  %d SENT to %s (%s)" % (r["id"], r["full_name"], to_addr))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "referrals"
    if mode == "selftest":
        selftest()
    elif mode == "referrals":
        referrals()
    else:
        raise SystemExit("usage: send_mail.py selftest | referrals")
