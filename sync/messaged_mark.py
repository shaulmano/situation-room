"""
Mark contacts that already have a LinkedIn conversation.

15.11.2026. Shaul stopped the wide outreach after a dozen sends: every one
of them had already received his first message months earlier, and none had
answered. The database knew about 97 contacts out of 2,662, because it was
built after that first wave.

The truth lives in the LinkedIn conversation list: a thread exists means he
already wrote. The reply agent loads that whole list on every run and throws
away everything that is not waiting for an answer.

Input is a JSON array of conversation display names. Matching is by the same
normalised name the reply agent already uses, and a name that is not in
contacts is reported and skipped rather than invented into a row.
"""
import json
import os
import sys
from urllib.parse import unquote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q           # noqa: E402
from replies_mark import norm           # noqa: E402


def slug_of(url):
    """הזהות של פרופיל לינקדאין: מה שאחרי /in/, בלי פרמטרים.

    **והוא מפוענח מקידוד אחוזים.** 15.11.2026: ברשימות של מאי אותו אדם
    רשום `%e2%98%85mor-barki%e2%98%85-952a2b188`, ובייצוא הקשרים הוא
    רשום `★mor-barki★-952a2b188`. שתי הצורות הן אותו פרופיל, ובלי
    הפענוח הן שני אנשים שונים, בלי שום סימן שהצלבה פספסה.
    """
    u = (url or '').strip().lower().rstrip('/')
    if not u:
        return ''
    if '/in/' in u:
        u = u.split('/in/')[-1]
    u = u.split('?')[0].split('#')[0].strip('/')
    if '/' in u or not u:
        return ''
    try:
        u = unquote(u)
    except Exception:
        pass
    return u


def looks_like_profile(s):
    s = (s or '').strip()
    return 'linkedin.com' in s.lower() or ('/in/' in s) or (
        ' ' not in s and '-' in s and len(s) > 5)


# לאיזו עמודה מותר לכתוב, ומה התאריך שנכתב בה.
#
# 15.11.2026. אותו מצליב משרת עכשיו שני דברים שונים, ולכן העמודה היא
# פרמטר ולא קבוע. **הרשימה סגורה בכוונה**: עמודה שמגיעה מהקלט ונכתבת
# כמו שהיא היא גם חור אבטחה וגם טעות כתיב שמצליחה בשקט ולא כותבת כלום.
#
# `li_seen_at` נכתב ב-now(), כי הסוכן מדווח על שיחה שהוא רואה עכשיו.
# `first_pitch_at` נכתב בתאריך קבוע של גל מאי: `outreach_done.txt` רושם
# מה יצא ולא מתי, ותאריך מומצא לכל אדם גרוע מתאריך אחד שאומר את האמת,
# "עד היום הזה הוא כבר קיבל את הפנייה". הקובץ עצמו נגמר ב-31.5.2026.
COLUMNS = {
    'li_seen_at': 'now()',
    'first_pitch_at': "'2026-05-31'::timestamptz",
}


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    col = (sys.argv[2] if len(sys.argv) > 2 else '').strip() or 'li_seen_at'
    if col not in COLUMNS:
        raise SystemExit('unknown column %r, expected one of %s'
                         % (col, ', '.join(sorted(COLUMNS))))
    stamp = COLUMNS[col]
    try:
        names = json.loads(raw or '[]')
    except ValueError as e:
        raise SystemExit('bad JSON: %s' % e)
    if not isinstance(names, list):
        raise SystemExit('expected a list of names')

    print('target column: %s' % col)
    print('conversation names in: %d' % len(names))
    if not names:
        print('nothing to do')
        return

    known = sql("select id, full_name, linkedin_url, %s from contacts" % col) or []
    by_name = {}
    by_slug = {}
    for c in known:
        if c.get('full_name'):
            by_name.setdefault(norm(c['full_name']), c)
        sl = slug_of(c.get('linkedin_url'))
        if sl:
            by_slug.setdefault(sl, c)

    hit = already = miss = 0
    ids = []
    # אותו אדם יכול להגיע בקלט גם כ-slug וגם כשם, ובלי זה הוא נספר
    # פעמיים ונכתב פעמיים באותה פקודה.
    seen_ids = set()
    for n in names:
        key = str(n).strip()
        # קישור פרופיל או slug מצליבים בוודאות, ושם מצליב בקירוב. שתי
        # הצורות מתקבלות באותו קלט כדי שלא יהיו שני מצבים לתחזק.
        # קודם slug, תמיד. שם תצוגה לא מייצר slug מתנגש, כי הוא מכיל
        # רווח ואין רווח באף slug, ולכן אין מה להגן עליו. הניסיון המותנה
        # שהיה כאן פספס כל slug בלי מקף, למשל `asafpublic`.
        who = by_slug.get(slug_of(key))
        if who is None and not looks_like_profile(key):
            who = by_name.get(norm(key))
        if not who:
            miss += 1
            continue
        if who.get(col):
            already += 1
            continue
        if who['id'] in seen_ids:
            already += 1
            continue
        seen_ids.add(who['id'])
        ids.append(who['id'])
        hit += 1

    # Batched, because a full sweep can carry hundreds of names.
    for i in range(0, len(ids), 200):
        chunk = ids[i:i + 200]
        sql("update contacts set %s = %s where id in (%s)"
            % (col, stamp, ','.join(q(x) for x in chunk)))

    print('marked %d, already marked %d, not in contacts %d' % (hit, already, miss))


if __name__ == '__main__':
    main()
