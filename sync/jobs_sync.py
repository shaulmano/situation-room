"""
Push the job-search bot's findings into the situation room.

Accepts a path or an https url. The url form is how the scheduled sync works:
the bot already scrapes every 90 minutes and commits jobs.jsonl to its public
repo, so this fetches that file instead of scraping everything a second time -
half a minute and no browser, against fifteen minutes and a Chromium install.
It also means the Supabase token stays out of the public repo.

The bot writes every reported job to jobs.jsonl in the (public) job-search repo.
That file is market data - what exists out there - so it is safe to mirror here.
What is NOT mirrored: recruiter names and urls. Those name real people who never
agreed to be catalogued, and they stay out of this database exactly as they are
being taken out of the public repo.

Run: python sync/jobs_sync.py [path-to-jobs.jsonl]
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q  # same Management API path, same reasoning

DEFAULT = os.path.expanduser("~/Documents/job-search/jobs.jsonl")
BATCH = 200

# Mirrors _RELEVANT_TITLE_RE / _is_mgmt in the bot, kept deliberately loose here:
# the bot already gated these rows, this is only a hint for the jobs screen.
ON_TARGET = (
    "qa", "quality", "test", "release", "delivery",
    "program", "project", "pmo", "בדיקות", "איכות", "פרויקט", "תוכנית",
)


def read_lines(src):
    if src.startswith("http"):
        import urllib.request
        req = urllib.request.Request(src, headers={"User-Agent": "situation-room-sync"})
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read().decode("utf-8").splitlines()
    with open(src, encoding="utf-8") as fh:
        return fh.readlines()


def rows(path):
    seen = set()
    if True:
        for line in read_lines(path):
            line = line.strip()
            if not line:
                continue
            try:
                j = json.loads(line)
            except ValueError:
                continue
            jid = j.get("id")
            if not jid or jid in seen:
                continue
            seen.add(jid)
            title = (j.get("title") or "").strip()
            if not title:
                continue
            # 9.11.2026: הכותרות של SecretJobs נגזרות מה-slug ונגמרות במזהה
            # הקסדצימלי, למשל "Project Manager Iot Solutions Telit Cinterion
            # B37C51C69951". הוא מופיע על המסך ומזהם גם את החיפוש בלינקדאין
            # שהכפתור בונה, ושאול אמר שהחיפוש לא מגיע לשום מקום.
            title = re.sub(r"\s+[0-9A-Fa-f]{8,}\s*$", "", title).strip() or title
            yield {
                "id": jid,
                "title": title[:200],
                # חברה ששמה כשם המקור אינה שם חברה. SecretJobs רשם את עצמו,
                # והשורה הציגה "SecretJobs · Israel" במקום שם המעסיק. שם
                # המעסיק האמיתי יושב ממילא בתוך הכותרת.
                "company": (
                    None
                    if (j.get("company") or "").strip().lower()
                    == (j.get("source") or "").strip().lower()
                    else (j.get("company") or "")[:120] or None
                ),
                "source": j.get("source") or "unknown",
                "url": j.get("url") or None,
                "location": (j.get("location") or "")[:120] or None,
                "posted": j.get("posted") or None,
                "first_seen": j.get("first_seen") or None,
                "last_seen": j.get("last_seen") or None,
                "on_target": any(k in title.lower() for k in ON_TARGET),
                # הבוט מושך את התיאור מהעמוד הציבורי של לינקדאין ועד 2.11.2026
                # הוא נזרק לפני הכתיבה לקובץ. בלי תיאור הניקוד עובד לפי הכותרת
                # בלבד, ושאול נדרש להדביק את המודעה ידנית כדי לקבל קורות חיים.
                "description": (j.get("description") or "")[:3000] or None,
                # התפקיד שהחיפוש שלו החזיר את המשרה. 10.11.2026: בלי זה אין
                # דרך להבדיל בין התפקידים ששאול באמת מחפש לבין כל השאר.
                "found_for": (j.get("found_for") or "")[:80] or None,
            }


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    if not path.startswith("http") and not os.path.exists(path):
        print("no such file: %s" % path)
        return
    all_rows = list(rows(path))
    print("parsed %d unique jobs from %s" % (len(all_rows), path.rsplit("/", 1)[-1]))

    total = 0
    for i in range(0, len(all_rows), BATCH):
        chunk = all_rows[i:i + BATCH]
        vals = ",".join(
            "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
            % (q(r["id"]), q(r["title"]), q(r["company"]), q(r["source"]), q(r["url"]),
               q(r["location"]), q(r["posted"]), q(r["first_seen"]), q(r["last_seen"]),
               "true" if r["on_target"] else "false", q(r["description"]),
               q(r["found_for"]))
            for r in chunk
        )
        sql(
            # Conflict on the url, not the id. jobs.jsonl and the live scan give
            # the same posting different ids, and the url is what identifies it.
            "insert into jobs "
            "(id,title,company,source,url,location,posted,first_seen,last_seen,on_target,"
            "description,found_for) "
            "values %s on conflict (url) do update set title=excluded.title, "
            "company=excluded.company, location=excluded.location, "
            "posted=excluded.posted, last_seen=excluded.last_seen, "
            "on_target=excluded.on_target, "
            # coalesce ולא השמה: שאול מדביק תיאורים ידנית, וריצה שבה הבוט לא
            # הביא תיאור היתה מוחקת את מה שהוא כתב.
            "description=coalesce(excluded.description, jobs.description), "
            # coalesce גם כאן: ריצה שבה התפקיד לא ידוע לא מוחקת את מה שכבר
            # נרשם. משרה שכמה חיפושים מצאו נשארת עם הראשון שרשם אותה.
            "found_for=coalesce(jobs.found_for, excluded.found_for);" % vals
        )
        total += len(chunk)
        print("  upserted %d/%d" % (total, len(all_rows)))

    out = sql("select source, count(*)::text as n from jobs group by source order by count(*) desc")
    print("\njobs by source:")
    for r in out:
        print("  %-14s %s" % (r["source"], r["n"]))


if __name__ == "__main__":
    main()
