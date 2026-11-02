"""הצד של GitHub בייצור קורות חיים לפי משרה.

למה דרך Actions ולא דרך מחבר Supabase: המחבר של קלוד מאפשר ארגון אחד בלבד,
והארגון שמחזיק את חדר המצב אינו זה שמחזיק את manomatic. החיבור הנוסף נחסם
כי הרשת של שאול לא מגיעה ל-api.supabase.com, ושם יושב מסך האישור.
לרנר של GitHub אין את הבעיה הזאת: הסריקה בענן כבר כותבת מכאן למסד כל יום.

שתי פקודות, ושתיהן נקראות מתוך .github/workflows/cv.yml:

    python sync/cv_requests.py fetch
        מדפיס את הבקשות הממתינות עם כל מה שצריך כדי לכתוב: תיאור המשרה,
        גרסת הבסיס, וההערה אם זו דחייה. קלוד קורא את הפלט הזה מיומן הריצה.

    python sync/cv_requests.py render <content.json> <request_id> <filename>
        מרנדר את ה-PDF מתוך התוכן שקלוד כתב, וכותב אותו חזרה לשורה.

הקובץ לא נוגע בשום טבלה אחרת ולא בשום שורה שאינה הבקשה שהוא עובד עליה.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "")

_TRANSIENT = ("upstream connect error", "connection termination", "502", "503", "504",
              "timeout", "EOF", "reset by peer")


def sb_token():
    tok = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if tok:
        return tok
    return open(os.path.expanduser("~/.situation-room/sb-token")).read().strip()


def sql(query, attempts=4):
    """POST דרך curl. urllib ו-requests נדחים על ידי Cloudflare בשגיאה 1010."""
    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump({"query": query}, fh)
    last = None
    try:
        for attempt in range(attempts):
            out = subprocess.run(
                ["curl", "-s", "--max-time", "180", "-X", "POST",
                 "https://api.supabase.com/v1/projects/%s/database/query" % PROJECT_REF,
                 "-H", "Authorization: Bearer %s" % sb_token(),
                 "-H", "Content-Type: application/json",
                 "--data-binary", "@%s" % path],
                capture_output=True, text=True, encoding="utf-8",
                errors="replace", timeout=200,
            ).stdout or ""
            if out.strip().startswith("{") and '"message"' in out:
                last = out[:300]
                if any(t in out for t in _TRANSIENT) and attempt < attempts - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(last)
            if not out.strip() and attempt < attempts - 1:
                time.sleep(2 ** attempt)
                continue
            return json.loads(out) if out.strip() else []
    finally:
        os.unlink(path)
    raise RuntimeError(last or "no response from Supabase")


def q(v):
    if v is None or v == "":
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def summary(text):
    """יומן הריצה הוא איך שקלוד קורא את הפלט, ולכן הוא נכתב גם לסיכום."""
    print(text)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(text + "\n")


def fetch():
    # שורה שנתקעה ב-working היא ריצה שנפלה באמצע. אחרי שעה היא חוזרת לתור
    # במקום להישאר תלויה לנצח ולחסום בקשה חדשה על אותה משרה.
    sql("update cv_requests set status = 'pending' "
        "where status = 'working' and created_at < now() - interval '1 hour';")

    # תמונת מצב קצרה של הטבלה. בלעדיה "אין בקשות" ו"הבקשה נתקעה במצב אחר"
    # נראים זהים, וזה בדיוק מה שבלבל אותנו בבדיקה הראשונה.
    for row in sql("select status, count(*) as n from cv_requests group by status order by status;"):
        summary("STATUS %s: %s" % (row["status"], row["n"]))

    rows = sql(
        "select r.id, r.job_id, r.base_cv_id, r.feedback, "
        "       j.title, j.company, j.url, j.description "
        "from cv_requests r join jobs j on j.id = r.job_id "
        "where r.status = 'pending' order by r.created_at limit 1;")

    if not rows:
        summary("PENDING: 0")
        return

    r = rows[0]
    # מסמנים working מיד, כדי ששתי ריצות לא יכתבו את אותה גרסה פעמיים.
    sql("update cv_requests set status = 'working' where id = %s;" % r["id"])

    cvs = sql("select id, label, content from cvs order by id;")
    base = next((c for c in cvs if c["id"] == r.get("base_cv_id")), None)

    prev = []
    if r.get("feedback"):
        prev = sql(
            "select result from cv_requests where job_id = %s and status = 'rejected' "
            "order by created_at desc limit 1;" % q(r["job_id"]))

    summary("PENDING: 1")
    summary("REQUEST_ID: %s" % r["id"])
    summary("JOB_TITLE: %s" % (r.get("title") or ""))
    summary("JOB_COMPANY: %s" % (r.get("company") or ""))
    summary("BASE_CV_ID: %s" % (r.get("base_cv_id") or ""))
    summary("FEEDBACK: %s" % (r.get("feedback") or ""))
    summary("--- JOB DESCRIPTION ---")
    summary(r.get("description") or "")
    summary("--- BASE CV ---")
    summary((base or {}).get("content") or
            "\n\n".join("## %s\n%s" % (c["id"], c.get("content") or "") for c in cvs))
    if prev:
        summary("--- PREVIOUS REJECTED VERSION ---")
        summary(prev[0].get("result") or "")
    summary("--- END ---")


def plain_text(content):
    """הטקסט שנשמר לצד הקובץ, כדי שאפשר יהיה לתקן ניסוח בלי לייצר מחדש."""
    out = [content.get("name", ""), content.get("headline", ""), content.get("contact", "")]
    if content.get("summary"):
        out += ["", "PROFESSIONAL SUMMARY", content["summary"]]
    if content.get("competencies"):
        out += ["", "CORE COMPETENCIES", content["competencies"]]
    out += ["", "PROFESSIONAL EXPERIENCE"]
    for role in content.get("roles", []):
        out += ["", role.get("title", "")]
        if role.get("context"):
            out.append(role["context"])
        out += ["  - " + b for b in role.get("bullets", [])]
    if content.get("tools"):
        out += ["", "TOOLS & METHODOLOGIES"]
        out += ["%s: %s" % (t.get("label", ""), t.get("text", "")) for t in content["tools"]]
    if content.get("education"):
        out += ["", "EDUCATION & CERTIFICATIONS", content["education"]]
    return "\n".join(out)


def render(content_path, request_id, filename):
    with open(content_path, encoding="utf-8") as fh:
        content = json.load(fh)

    script = os.path.join(ROOT, "tools", "render_cv.mjs")
    proc = subprocess.run(["node", script, content_path],
                          capture_output=True, text=True, timeout=240)
    if proc.returncode != 0:
        note = (proc.stderr or "rendering failed").strip().splitlines()[-1][:200]
        sql("update cv_requests set status = 'error', note = %s where id = %s;"
            % (q(note), request_id))
        summary("ERROR: %s" % note)
        raise SystemExit(1)

    b64 = proc.stdout.strip()
    # שפיות: PDF תקין מתחיל ב-%PDF, וב-base64 זה JVBER.
    if not b64.startswith("JVBER"):
        sql("update cv_requests set status = 'error', note = %s where id = %s;"
            % (q("הפלט אינו קובץ PDF תקין"), request_id))
        summary("ERROR: output is not a PDF")
        raise SystemExit(1)

    name = "".join(c for c in (filename or "cv.pdf") if c.isalnum() or c in "._-") or "cv.pdf"
    if not name.lower().endswith(".pdf"):
        name += ".pdf"

    # מרכאות דולר: ה-base64 הוא כמאה אלף תווים ואין טעם לברוח כל גרש בנפרד.
    sql("update cv_requests set status = 'done', done_at = now(), "
        "filename = %s, result = %s, pdf_base64 = $b64$%s$b64$ where id = %s;"
        % (q(name), q(plain_text(content)), b64, request_id))

    summary("DONE: request %s, %s, %d bytes of base64"
            % (request_id, name, len(b64)))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "fetch"
    if mode == "fetch":
        fetch()
    elif mode == "render":
        render(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "cv.pdf")
    else:
        raise SystemExit("unknown mode: %s" % mode)
