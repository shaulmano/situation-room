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
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q


def job_id(url):
    return hashlib.sha1((url or '').encode('utf-8')).hexdigest()[:32]


def _norm(u):
    return (u or '').split('?')[0].split('#')[0].rstrip('/')


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """עוצר על ההפניה הראשונה ומחזיר את היעד, במקום לעקוב אחריה."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise _Redirected(newurl)


class _Redirected(Exception):
    def __init__(self, to):
        self.to = to


def bounced_up(url, target):
    """האם ההפניה העלתה אותנו אל הלוח, כלומר אל תחילית של הכתובת שביקשנו.

    מופרד מהרשת בכוונה, כדי שאפשר יהיה לבדוק את ההחלטה עצמה בלי לצאת
    החוצה. ההפרדה הזאת היא התיקון ללקח מ-14.11: תיקון שנדחף בלי להריץ
    אותו אפילו פעם אחת.
    """
    a, b = _norm(url), _norm(target)
    if not b or a == b:
        return False
    # רק באותו מארח. הפניה לדומיין אחר אינה קפיצה ללוח.
    if urllib.parse.urlsplit(a).netloc != urllib.parse.urlsplit(b).netloc:
        return False
    return a.startswith(b + '/')


def posting_is_live(url, timeout=12):
    """האם הכתובת עדיין מובילה למודעה עצמה.

    ‏15.11.2026. שאול שלח את `comeet.com/jobs/liveu/90.00C` ואמר **"אין בה
    בכלל את המשרה של ניהול פרויקטים"**. הכתובת שבמסד הייתה דווקא תקינה
    ומלאה, `.../project-manager--pmo/47.163`, אבל **Comeet מפנה מודעה
    שנסגרה אל שורש הלוח במקום להחזיר 404**. נמדד בדפדפן אמיתי: בקשה עם
    `redirect: manual` חוזרת `opaqueredirect`, כלומר הפניה אמיתית ברמת
    HTTP, והיעד הוא שורש הלוח. בלוח עצמו שבע משרות פתוחות ואף אחת מהן
    אינה ניהול פרויקטים.

    **וזה מפיל הנחה שעליה נבנה המסך הזה.** ב-14.11 נכתב כאן, ובצדק לגבי
    Greenhouse, שבלוח ATS מודעה שנסגרה נעלמת מה-API ולכן מה שמופיע פתוח
    בהגדרה, וזאת הסיבה שאין במסך הזה שער גיל. Comeet לא מתנהג ככה:
    הקישור נשאר חי לנצח ותוצאה ישנה בגוגל ממשיכה להיראות כמו משרה.

    **המבחן הוא כללי ולא ספציפי ל-Comeet:** אם ההפניה מעלה אותנו לכתובת
    שהיא תחילית של זו שביקשנו, הוקפצנו אל הלוח, והמודעה איננה.

    **ובמקרה של ספק מחזירים אמת.** תקלת רשת, שעת פסק או חסימה אינן ראיה
    שהמשרה נסגרה, והורדת שורה אמיתית בגלל זה גרועה בהרבה משורה מתה אחת
    שנשארת. כל פסילה מודפסת עם הסיבה.
    """
    req = urllib.request.Request(url, method='GET', headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/140.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
    })
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        opener.open(req, timeout=timeout).close()
        return True, ''
    except _Redirected as e:
        target = urllib.parse.urljoin(url, e.to)
        if bounced_up(url, target):
            return False, 'redirects up to the board: %s' % _norm(target)
        return True, ''
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            return False, 'HTTP %d' % e.code
        return True, ''
    except Exception as e:
        print('  could not check %s: %s' % (url[:70], e))
        return True, ''


def sweep_open_rows(limit=40):
    """סוגר שורות רדאר שהמודעה שלהן כבר לא קיימת.

    **וזה לא סותר את "שורה יורדת רק כשאני סוגר אותה".** הכלל ההוא נאמר על
    גיל, ושאול נימק אותו במילים שלו: "אם הן מופיעות בדף החברה הן עדיין
    קיימות". זה בדיוק המבחן שמורץ כאן, ושורה שנופלת בו היא שורה שלפי
    ההיגיון שלו עצמו כבר אינה משרה. אין כאן שער גיל ולא יהיה.

    רץ אחרי הכתיבה היומית, ועד 40 שורות בריצה כדי לא להאריך אותה.
    """
    rows = sql(
        "select id, url, title from jobs "
        "where seo and dismissed_at is null and coalesce(url,'') <> '' "
        "order by last_seen desc limit %d" % int(limit)
    ) or []
    if not rows:
        return
    gone = []
    for r in rows:
        ok, why = posting_is_live(r.get('url') or '')
        if not ok:
            gone.append(r)
            print('  closing, %s: %s' % (why, (r.get('title') or '')[:50]))
    if not gone:
        print('swept %d open radar rows, all still live' % len(rows))
        return
    sql('update jobs set dismissed_at = now() where id in (%s)'
        % ','.join(q(g['id']) for g in gone))
    print('swept %d open radar rows, closed %d' % (len(rows), len(gone)))


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

    # בדיקת חיות לפני הכתיבה. שורה שהקישור שלה מקפיץ ללוח אינה משרה,
    # והיא תישלח את שאול לעמוד שאין בו את מה שכתוב עליה.
    live = []
    for r in clean:
        ok, why = posting_is_live((r.get('url') or '').strip())
        if ok:
            live.append(r)
        else:
            print('  dropped, %s: %s' % (why, (r.get('title') or '')[:50]))
    if len(live) != len(clean):
        print('dropped %d dead postings' % (len(clean) - len(live)))
    clean = live

    sweep_open_rows()

    if not clean:
        print('nothing to write')
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
