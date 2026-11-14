"""כותב למסד משרות שנמצאו בחיפוש הבוליאני בגוגל.

‏14.11.2026. שאול שלח את המדריך "מתחת לרדאר" וביקש להתאים אותו. לב המדריך
הוא שאילתת `site:` אחת שסורקת את כל פלטפורמות ה-ATS בבת אחת, במקום לקרוא
27 לוחות מרשימה קבועה.

**למה זה לא יושב בבוט אלא כאן.** נמדד באותו ערב: גוגל מחזיר לראנר של
GitHub מסך "הפעל JavaScript" של 6,644 בתים ולא תוצאות, בדיוק כמו Glassdoor
ו-Indeed. לקלוד עצמו גוגל כן עונה, ולכן המשימה המתוזמנת מריצה את החיפוש
ושולחת לכאן את מה שמצאה.

הקלט הוא JSON, מערך של שורות:

    [{"title": "...", "company": "...", "url": "https://...",
      "location": "Tel Aviv", "source": "Greenhouse",
      "found_for": "Project Manager", "description": "..."}]

    python sync/seo_jobs.py '<json>'

**הכתיבה היא תמיד upsert לפי url, והדגל רק נדלק.** משרה שהסריקה הרגילה
כבר הביאה ושהחיפוש מצא גם הוא היא משרה שהחיפוש מצא, וזה מה ששאול ביקש
לראות. כיבוי הדגל היה מוחק את הסימון בסריקה האוטומטית הבאה, בדיוק כמו
שקרה עם `manual` ב-10.11.

**ואחרי הכתיבה חייב לרוץ score.py.** משרה שנכנסה ל-jobs בלי שורה
ב-matches אינה מוצגת בשום מסך שמצרף אותן, בלי שום שגיאה. מסך SEO עצמו
קורא מ-jobs ישירות ולכן אינו נופל במלכודת, אבל שאר המסכים כן.
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q


def job_id(url):
    return hashlib.sha1((url or '').encode('utf-8')).hexdigest()[:32]


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    try:
        rows = json.loads(raw or '[]')
    except ValueError as e:
        raise SystemExit('bad JSON: %s' % e)
    if not isinstance(rows, list):
        raise SystemExit('expected a list')

    clean = []
    seen = set()
    for r in rows:
        url = (r.get('url') or '').strip()
        title = (r.get('title') or '').strip()
        if not url or not title or url in seen:
            continue
        seen.add(url)
        clean.append(r)

    print('seo rows in: %d, usable: %d' % (len(rows), len(clean)))
    if not clean:
        print('nothing to do')
        return

    values = []
    for r in clean:
        url = (r.get('url') or '').strip()
        values.append(
            '(%s,%s,%s,%s,%s,%s,%s,now(),now(),true,true,%s)' % (
                q(job_id(url)),
                q((r.get('title') or '')[:200]),
                q((r.get('company') or '')[:120] or None),
                q((r.get('source') or 'SEO')[:40]),
                q(url),
                q((r.get('location') or '')[:120] or None),
                q((r.get('description') or '')[:4000] or None),
                q((r.get('found_for') or '')[:80] or None),
            )
        )

    stmt = (
        'insert into jobs '
        '(id,title,company,source,url,location,description,first_seen,last_seen,'
        'on_target,seo,found_for) values %s '
        'on conflict (url) do update set '
        'title=excluded.title, company=excluded.company, '
        'location=coalesce(excluded.location, jobs.location), '
        'description=coalesce(jobs.description, excluded.description), '
        'last_seen=now(), on_target=true, '
        # הדגל רק נדלק, כמו manual.
        'seo=true, '
        'found_for=coalesce(jobs.found_for, excluded.found_for) '
        'returning (xmax = 0) as inserted'
    )
    got = sql(stmt % ','.join(values))
    fresh = sum(1 for g in (got or []) if g.get('inserted') in (True, 't', 'true'))
    print('written %d, of them new %d, already known %d'
          % (len(got or []), fresh, len(got or []) - fresh))
    print('remember: score.py must run after this')


if __name__ == '__main__':
    main()
