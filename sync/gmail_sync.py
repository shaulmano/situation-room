"""
Backfill and refresh applications from Gmail over IMAP.

LinkedIn confirms every Easy Apply by email, and the body carries everything we
need: company, job title, location and the job's LinkedIn id. That makes Gmail a
complete record of the application history - no Google Cloud project, no OAuth
consent screen, just the app password that already existed for the job-search bot.

Writes through the Supabase Management API rather than the CLI: the ref sits in
the URL there, so it cannot be misresolved. `supabase db query --linked` silently
targets the account-level linked project, which is a production database.
"""
import email, imaplib, json, os, re, subprocess, sys, tempfile, time
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "egxsgxoecucmwaktprez")
SENT_RE = re.compile(r"your application was sent to\s+(.+)$", re.I)
VIEWED_RE = re.compile(r"your application was viewed by\s+(.+)$", re.I)
JOB_RE = re.compile(r"linkedin\.com/comm/jobs/view/(\d+)")


def creds():
    """App password from the job-search secrets, or the environment in CI."""
    if os.environ.get("GMAIL_APP_PASSWORD"):
        return os.environ["GMAIL_ADDRESS"], os.environ["GMAIL_APP_PASSWORD"]
    sys.path.insert(0, os.path.expanduser("~/.job-search-secrets"))
    import secrets as S
    return S.GMAIL_ADDRESS, S.GMAIL_APP_PASSWORD


def sb_token():
    if os.environ.get("SUPABASE_ACCESS_TOKEN"):
        return os.environ["SUPABASE_ACCESS_TOKEN"]
    return open(os.path.expanduser("~/.situation-room/sb-token")).read().strip()


# Supabase drops the occasional request under a long batch run - a scoring pass
# is three thousand rows and one "connection termination" used to kill the whole
# workflow after the sync step had already succeeded.
_TRANSIENT = ("upstream connect error", "connection termination", "502", "503", "504",
              "timeout", "EOF", "reset by peer")


def sql(query, attempts=4):
    """POST via curl - urllib and requests are refused by Cloudflare (error 1010)."""
    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump({"query": query}, fh)

    last = None
    try:
        for attempt in range(attempts):
            out = subprocess.run(
                [
                    "curl", "-s", "--max-time", "180", "-X", "POST",
                    "https://api.supabase.com/v1/projects/%s/database/query" % PROJECT_REF,
                    "-H", "Authorization: Bearer %s" % sb_token(),
                    "-H", "Content-Type: application/json",
                    "--data-binary", "@%s" % path,
                ],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=200,
            ).stdout or ""

            if out.strip().startswith("{") and '"message"' in out:
                last = out[:300]
                if any(t in out for t in _TRANSIENT) and attempt < attempts - 1:
                    time.sleep(2 ** attempt)   # 1s, 2s, 4s
                    continue
                raise RuntimeError(last)

            if not out.strip() and attempt < attempts - 1:
                # curl returning nothing at all is a dropped connection too.
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


def body_of(msg):
    for part in msg.walk():
        if part.get_content_type() == "text/plain":
            return part.get_payload(decode=True).decode("utf-8", "ignore")
    for part in msg.walk():
        if part.get_content_type() == "text/html":
            html = part.get_payload(decode=True).decode("utf-8", "ignore")
            return re.sub(r"<[^>]+>", " ", html)
    return ""


def parse_sent(subject, text):
    """Body reads: '<company> <title> <company> <location> View job: <url>'."""
    m = SENT_RE.search(subject)
    if not m:
        return None
    company = m.group(1).strip()
    title = location = None
    anchor = "was sent to " + company
    i = text.find(anchor)
    if i >= 0:
        rest = text[i + len(anchor):]
        j = rest.find(company)
        if j > 0:
            title = rest[:j].strip() or None
            after = rest[j + len(company):]
            k = after.lower().find("view job")
            if k > 0:
                location = after[:k].strip() or None
    job = JOB_RE.search(text)
    return {
        "company": company,
        "title": title,
        "location": location,
        "job_id": "li-" + job.group(1) if job else None,
        "url": "https://www.linkedin.com/jobs/view/" + job.group(1) if job else None,
    }


def cv_for(title):
    t = (title or "").lower()
    if any(w in t for w in ("release", "delivery")):
        return "delivery"
    if any(w in t for w in ("project", "program", "pmo")):
        return "program"
    return "qa"


def fetch(M, query, label):
    typ, data = M.search(None, query)
    ids = data[0].split()
    print("%s: %d" % (label, len(ids)))
    for n, i in enumerate(ids, 1):
        typ, d = M.fetch(i, "(RFC822)")
        msg = email.message_from_bytes(d[0][1])
        subject = str(make_header(decode_header(msg["Subject"] or "")))
        yield subject, msg
        if n % 25 == 0:
            print("  %d/%d" % (n, len(ids)))


def main():
    addr, pw = creds()
    M = imaplib.IMAP4_SSL("imap.gmail.com")
    M.login(addr, pw.replace(" ", ""))
    M.select('"[Gmail]/All Mail"', readonly=True)

    jobs, apps, events = {}, {}, []

    q_sent = '(FROM "jobs-noreply@linkedin.com" SUBJECT "your application was sent to")'
    for subject, msg in fetch(M, q_sent, "confirmations"):
        rec = parse_sent(subject, " ".join(body_of(msg).split()))
        if not rec:
            continue
        when = parsedate_to_datetime(msg["Date"]).isoformat()
        key = rec["job_id"] or "%s|%s" % (rec["company"], when[:10])
        if rec["job_id"]:
            jobs[rec["job_id"]] = rec
        apps[key] = dict(rec, sent_at=when, key=key)

    q_view = '(FROM "jobs-noreply@linkedin.com" SUBJECT "your application was viewed")'
    for subject, msg in fetch(M, q_view, "view events"):
        m = VIEWED_RE.search(subject)
        if m:
            events.append({
                "company": m.group(1).strip(),
                "at": parsedate_to_datetime(msg["Date"]).isoformat(),
            })
    M.logout()

    if jobs:
        vals = ",".join(
            "(%s,%s,%s,'LinkedIn',%s,%s,true)"
            % (q(k), q(v["title"] or "Unknown"), q(v["company"]), q(v["url"]), q(v["location"]))
            for k, v in jobs.items()
        )
        sql(
            "insert into jobs (id,title,company,source,url,location,on_target) values %s "
            "on conflict (id) do update set title=excluded.title, company=excluded.company, "
            "url=excluded.url, location=excluded.location;" % vals
        )
        print("jobs upserted: %d" % len(jobs))

    if apps:
        vals = ",".join(
            "(%s,%s,%s,%s,'linkedin',%s,%s,'sent')"
            % (q(a["job_id"]), q(cv_for(a["title"])), q(a["company"]), q(a["title"]),
               q("li:" + a["key"]), q(a["sent_at"]))
            for a in apps.values()
        )
        sql(
            "insert into applications "
            "(job_id,cv_id,company,role,channel,gmail_thread_id,sent_at,status) "
            "values %s on conflict (gmail_thread_id) do nothing;" % vals
        )
        print("applications upserted: %d" % len(apps))

    # A view is the only engagement signal LinkedIn gives, so treat it as one rung up.
    for e in events:
        sql("update applications set status='acknowledged' where company=%s and status='sent';"
            % q(e["company"]))
    print("view events applied: %d" % len(events))

    # No engagement after 14 days is silence, not a pending answer.
    sql("update applications set status='silent' "
        "where status='sent' and sent_at < now() - interval '14 days';")
    print("done")


if __name__ == "__main__":
    main()
