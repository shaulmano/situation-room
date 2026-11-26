"""מייבא את גל מאי ל-prior_requests.

26.11.2026, באישור שאול. הקלט הוא base64 של gzip של JSON: [{s,n,t,c}] עם slug,
שם, תפקיד וחברה. הנתונים לא נכנסים למאגר (הוא ציבורי), והם עוברים בקלט הריצה.

מדלג על מי שכבר ב-contacts (חבר או מסומן), ב-gold_recruiters, או כבר יובא.
קריאה ל-sql אחת לכל שלב, והריצה בטוחה לחזרה.
"""
import base64
import gzip
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql              # noqa: E402
from messaged_mark import slug_of       # noqa: E402


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("CONTENT", "")
    people = json.loads(gzip.decompress(base64.b64decode(raw)).decode("utf-8"))
    have = set()
    for r in sql("select linkedin_url from contacts where linkedin_url is not null") or []:
        have.add(slug_of(r["linkedin_url"]))
    for r in sql("select profile_url from gold_recruiters where profile_url is not null") or []:
        have.add(slug_of(r["profile_url"]))
    for r in sql("select slug from prior_requests") or []:
        have.add(r["slug"])
    fresh, seen = [], set()
    for p in people:
        s = slug_of(p["s"])
        if not s or s in have or s in seen:
            continue
        seen.add(s)
        fresh.append({"s": s, "n": (p["n"] or "").strip() or s, "t": (p["t"] or "").strip() or None,
                      "c": (p["c"] or "").strip() or None})
    print(f"input {len(people)}, already known {len(people) - len(fresh)}, new {len(fresh)}")
    if not fresh:
        return
    body = json.dumps(fresh, ensure_ascii=False)
    assert "$j$" not in body
    sql("insert into prior_requests (slug, full_name, title, company) "
        "select s, n, t, c from jsonb_to_recordset($j$" + body + "$j$::jsonb) as x(s text, n text, t text, c text) "
        "on conflict (slug) do nothing")
    print("imported", len(fresh))


if __name__ == "__main__":
    main()
