"""
לוחות הקריירה של החברות: לקרוא מהמקור במקום מהאינדקס של גוגל.

15.11.2026. שאול: "זאת אומרת שאתה תעשה חיפוש על מנת למצוא את החברות,
תלך חברה חברה לדף קריירה שלהם ותחפש אם קיים אחד ממילות החיפוש של
המשרות שלנו?" וזאת בדיוק הכוונה.

**למה.** נמדד באותו ערב: מתוך 12 מודעות שגוגל החזיר ללוחות ATS, **11
היו כבר סגורות**. האינדקס של גוגל ללוחות האלה ישן מאוד. נבדק גם בדפדפן
אמיתי כדי לוודא שהבדיקה לא טועה: המודעה של Moovit הקפיצה לשורש הלוח,
ובלוח יש שתי משרות פתוחות ואף אחת מהן אינה Delivery Manager.

**שורש לוח, לעומת זאת, אינו יכול להיות ישן.** הוא רשימת המשרות
הפתוחות של החברה ברגע שקוראים אותו. לכן גוגל משמש לגילוי **חברות**,
והלוח עצמו משמש לגילוי **משרות**.

**וזה מה שהבוט כבר עושה עם 27 לוחות Greenhouse, רק שם הרשימה נכתבה
ידנית ולא גדלה לעולם.** כאן היא גדלה לבד: כל יום החיפוש מגלה עוד
חברות, הן נשמרות ב-`boards`, ומהיום שאחרי נקראות ישירות.

    python sync/boards.py probe <url>   # מה אפשר לחלץ מלוח אחד
    python sync/boards.py add <json>    # רישום לוחות שהתגלו
    python sync/boards.py read          # קריאת כל הלוחות וכתיבת משרות
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q   # noqa: E402

try:
    from curl_cffi import requests as cf
except Exception:
    cf = None
import urllib.request   # noqa: E402

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/136.0 Safari/537.36')


def fetch(url, timeout=25):
    if cf is not None:
        r = cf.get(url, impersonate='chrome136', timeout=timeout)
        return r.status_code, r.text
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode('utf-8', 'replace')


# ---------------------------------------------------------------- extraction

def _json_blobs(html):
    """
    כל מה שנראה כמו JSON מוטמע בתוך תגית script.

    **הרשימה אינה קישורים.** נמדד: הראנר מקבל 132 אלף בתים משורש לוח
    של Comeet ובהם **אפס** קישורי /jobs/, בזמן שהדפדפן מציג רשימה
    מלאה. אין גם קריאת API: נבדקה תעבורת הרשת של הדף ואין בה בקשה
    לרשימת משרות. כלומר הנתונים יושבים ב-HTML עצמו, בתוך script.
    """
    for m in re.finditer(r'<script[^>]*>(.*?)</script>', html, re.S | re.I):
        body = m.group(1)
        if len(body) < 80:
            continue
        if 'position' not in body.lower() and 'job' not in body.lower():
            continue
        yield body


def comeet_positions(html):
    """
    משרות מתוך שורש לוח של Comeet.

    הצורה שנמדדה: אובייקטים עם uid, name ו-location בתוך ה-script.
    נשענים על השדות ולא על סדר, כי סדר משתנה.
    """
    out = []
    seen = set()
    for body in _json_blobs(html):
        # אובייקט משרה שלם, לא רגקס על שדה בודד: שם בלי מיקום הוא
        # שורה שאי אפשר לסנן לפי ישראל, וזה בדיוק מה שאסור להכניס.
        for m in re.finditer(
                r'\{[^{}]*?"uid"\s*:\s*"([^"]+)"[^{}]*?"name"\s*:\s*"([^"]+)"[^{}]*?\}',
                body):
            uid, name = m.group(1), m.group(2)
            if uid in seen:
                continue
            blob = m.group(0)
            loc = ''
            lm = re.search(r'"location"\s*:\s*\{([^{}]*)\}', blob)
            if lm:
                parts = re.findall(r'"(?:name|city|country)"\s*:\s*"([^"]+)"', lm.group(1))
                loc = ', '.join(dict.fromkeys(parts))
            if not loc:
                lm = re.search(r'"location"\s*:\s*"([^"]+)"', blob)
                loc = lm.group(1) if lm else ''
            seen.add(uid)
            out.append({'uid': uid, 'title': name, 'location': loc})
    return out


def slugify(s):
    s = re.sub(r'[^0-9A-Za-z]+', '-', (s or '')).strip('-').lower()
    return re.sub(r'-+', '-', s)


def comeet_job_url(board_url, title, uid):
    base = board_url.split('?')[0].rstrip('/')
    return '%s/%s/%s' % (base, slugify(title), uid)


def greenhouse_positions(html):
    """לוח Greenhouse מרונדר בשרת: הקישורים נמצאים ב-HTML."""
    out = []
    for m in re.finditer(
            r'<a[^>]+href="([^"]*?/jobs/\d+[^"]*)"[^>]*>(.*?)</a>', html, re.S | re.I):
        href, label = m.group(1), re.sub(r'<[^>]+>', ' ', m.group(2))
        title = ' '.join(label.split())
        if title:
            out.append({'uid': href, 'title': title, 'location': ''})
    return out


# ---------------------------------------------------------------- filtering

ROLES = [
    'project manager', 'technical project manager', 'program manager',
    'technical program manager', 'delivery manager', 'release manager',
    'qa manager', 'qa director', 'head of qa', 'pmo', 'qa team lead',
    'qa team leader', 'director of program management', 'head of delivery',
    'head of project management', 'head of program management',
    'מנהל פרויקט', 'מנהלת פרויקט', 'מנהל/ת פרויקט', 'מנהל תוכנית',
    'מנהל/ת תוכנית', 'ראש תחום פרויקטים',
]

# מילים שנראות כמו התפקיד ואינן הוא. אותו שער שקיים בבוט.
NOT_ROLE = ['product manager', 'engineering manager', 'account manager',
            'sales manager', 'community manager', 'office manager',
            'marketing manager', 'customer success manager']

ISRAEL = ['israel', 'ישראל', 'tel aviv', 'tel-aviv', 'herzliya', 'herzeliya',
          'petah', 'petach', 'ra\'anana', 'raanana', 'netanya', 'yokneam',
          'jerusalem', 'haifa', 'rehovot', 'ness ziona', 'rosh ha', 'ramat gan',
          'givatayim', 'holon', 'bnei brak', 'kfar saba', 'hod hasharon',
          'beer sheva', 'caesarea', 'airport city', 'modiin', 'lod', 'rishon']


def role_of(title):
    low = (title or '').lower()
    if any(b in low for b in NOT_ROLE):
        return None
    # הארוך ביותר שמתאים, כדי ש-Technical Project Manager לא ייקרא
    # Project Manager ויאבד את הדיוק ב-found_for.
    hits = [r for r in ROLES if r in low]
    return max(hits, key=len).title() if hits else None


def in_israel(location):
    low = (location or '').lower()
    return any(k in low for k in ISRAEL)


# ---------------------------------------------------------------- commands

def cmd_probe(url):
    code, html = fetch(url)
    print('HTTP %s  %d bytes' % (code, len(html)))
    rows = comeet_positions(html) or greenhouse_positions(html)
    print('positions found: %d' % len(rows))
    for r in rows[:40]:
        keep = role_of(r['title'])
        print('  %-52s | %-28s | %s' % (
            r['title'][:52], r['location'][:28],
            ('KEEP as ' + keep) if keep and in_israel(r['location']) else '-'))


def cmd_add(payload):
    rows = json.loads(payload)
    added = 0
    for r in rows:
        url = (r.get('url') or '').split('?')[0].rstrip('/')
        company = (r.get('company') or '').strip()
        if not url or not company:
            continue
        got = sql(
            "insert into boards (company, url, source) values (%s, %s, %s) "
            "on conflict (url) do nothing returning id"
            % (q(company), q(url), q(r.get('source') or '')))
        if got:
            added += 1
            print('  new board: %-28s %s' % (company[:28], url))
    print('boards in: %d, new: %d' % (len(rows), added))


def cmd_read(limit=60):
    boards = sql("select id, company, url, source from boards "
                 "where dead_since is null order by coalesce(last_read_at, "
                 "'epoch'::timestamptz) asc limit %d" % limit) or []
    print('boards to read: %d' % len(boards))
    found = []
    for b in boards:
        try:
            code, html = fetch(b['url'])
        except Exception as e:
            print('  %-28s fetch failed: %s' % (b['company'][:28], e))
            sql("update boards set last_read_at = now(), last_ok = false "
                "where id = %s" % q(b['id']))
            continue
        if code != 200:
            print('  %-28s HTTP %s' % (b['company'][:28], code))
            sql("update boards set last_read_at = now(), last_ok = false "
                "where id = %s" % q(b['id']))
            continue
        rows = comeet_positions(html) or greenhouse_positions(html)
        kept = 0
        for r in rows:
            role = role_of(r['title'])
            if not role or not in_israel(r['location']):
                continue
            url = (comeet_job_url(b['url'], r['title'], r['uid'])
                   if 'comeet' in b['url'] else r['uid'])
            found.append({'title': r['title'], 'company': b['company'],
                          'url': url, 'location': r['location'],
                          'source': b['source'] or 'Comeet', 'found_for': role})
            kept += 1
        print('  %-28s %3d open, %d on target' % (b['company'][:28], len(rows), kept))
        sql("update boards set last_read_at = now(), last_ok = true, "
            "open_count = %d where id = %s" % (len(rows), q(b['id'])))

    print('on target across all boards: %d' % len(found))
    print(json.dumps(found, ensure_ascii=False))
    return found


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'read'
    if cmd == 'probe':
        cmd_probe(sys.argv[2])
    elif cmd == 'add':
        cmd_add(sys.argv[2])
    else:
        cmd_read()
