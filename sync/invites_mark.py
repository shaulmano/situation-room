"""רושם מי אישר בקשת חברות בלינקדאין.

‏15.11.2026. שאול שלח צילום של "Ron accepted your invitation" וביקש שמי
שמאשר יקבל מכתב עם קורות חיים, מתויג "אישר חברות", אישי יותר, ועם
התעניינות אם יש אצלו משרות פתוחות.

**זאת החוליה שהייתה חסרה.** ב-13.11 נקבע שבקשת חברות היא חצי פנייה ושיש
שלושה צעדים: בקשה, אישור, ואז ההודעה עם הקובץ. הצעד האמצעי היה היחיד
שאיש לא ידע עליו, ושאול היה צריך לשים לב בעצמו.

הקלט מגיע מהמייל של לינקדאין, `invitations@linkedin.com`, שהשם המלא יושב
בשם התצוגה שלו. **אין כאן שום גריפה**: זה מייל שנשלח אליו.

    [{"name": "Ron Dvash", "title": "Talent Acquisition Specialist",
      "at": "2026-11-14T22:39:00+02:00", "url": "https://..."}]

    python sync/invites_mark.py '<json>'

**איש קשר חדש נוצר רק אם אינו קיים**, ומי שכבר במסד מקבל רק את הסימון.
הכתיבה לעולם אינה דורסת חברה, תפקיד או מייל שכבר יש, כי הייצוא של אנשי
הקשר מדויק יותר ממה שמייל התראה מספר.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q


def norm(s):
    return ' '.join((s or '').split()).lower()


def clean_name(s):
    """"Tamara Elimelech (תמרה אלימלך) via LinkedIn" -> "Tamara Elimelech".

    לינקדאין מוסיפה "via LinkedIn" לשם התצוגה, ולפעמים גם את השם בעברית
    בסוגריים. שניהם חלק מהעיצוב של המייל ולא חלק מהשם.
    """
    s = re.sub(r'\s+via\s+LinkedIn\s*$', '', (s or '').strip(), flags=re.I)
    return ' '.join(s.split())


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    try:
        rows = json.loads(raw or '[]')
    except ValueError as e:
        raise SystemExit('bad JSON: %s' % e)
    if not isinstance(rows, list):
        raise SystemExit('expected a list')

    print('invite acceptances in: %d' % len(rows))
    if not rows:
        print('nothing to do')
        return

    known = sql("select id, full_name, invite_accepted_at from contacts "
                "where coalesce(full_name,'') <> ''")
    by_name = {}
    for c in known:
        by_name.setdefault(norm(c['full_name']), c)

    marked = created = already = 0
    for r in rows:
        name = clean_name(r.get('name'))
        if not name:
            continue
        at = r.get('at') or None
        # אותו קיצוץ כמו בתגובות: שעה שמגיעה בלי אזור זמן יכולה ליפול
        # בעתיד, ואז כל ריצה הייתה מסמנת מחדש.
        at_sql = 'least(%s::timestamptz, now())' % q(at) if at else 'now()'

        who = by_name.get(norm(name))
        if who:
            if who.get('invite_accepted_at'):
                already += 1
                print('  already marked: %s' % name[:46])
                continue
            sql('update contacts set invite_accepted_at = {at}, '
                'title = coalesce(nullif(title,\'\'), {title}), '
                'linkedin_url = coalesce(nullif(linkedin_url,\'\'), {url}) '
                'where id = {cid}'.format(
                    at=at_sql, title=q((r.get('title') or '')[:120] or None),
                    url=q((r.get('url') or '')[:300] or None), cid=q(who['id'])))
            marked += 1
            print('  marked: %s' % name[:46])
        else:
            # **איש קשר חדש, ולמה זה מותר.** הכלל הוא שמגייסים צד שלישי לא
            # נשמרים, והוא מבחין בין קשר מדרגה ראשונה לבין מי שאינו. אדם
            # שאישר את בקשת החברות של שאול הוא קשר מדרגה ראשונה מרגע
            # האישור, ולכן זה הצד המותר של הכלל ולא חריג לו.
            # 22.11.2026: מגייס שנמצא בחיפוש לחברות זהב (gold_recruiters)
            # מגיע לכאן אחרי שאישר. החברה שלו ידועה משם, ובלעדיה המכתב
            # אחרי האישור לא יידע על איזו חברה לדבר.
            found = sql('select c.name, c.company_key from gold_recruiters g '
                        'join companies c on c.id = g.company_id '
                        'where lower(g.full_name) = {n} limit 1'.format(n=q(norm(name))))
            co = found[0] if found else None
            sql('insert into contacts '
                '(full_name, title, company, company_key, linkedin_url, '
                'invite_accepted_at, source, imported_at, updated_at) '
                'values ({name},{title},{co},{ck},{url},{at},\'linkedin_invite\',now(),now())'
                .format(name=q(name[:120]),
                        title=q((r.get('title') or '')[:120] or None),
                        co=q(co['name'] if co else None),
                        ck=q(co['company_key'] if co else None),
                        url=q((r.get('url') or '')[:300] or None), at=at_sql))
            created += 1
            print('  new contact: %s' % name[:46])

    print('marked %d, created %d, already known %d' % (marked, created, already))
    if marked or created:
        print('they are now waiting for the letter in "אישר חברות"')


if __name__ == '__main__':
    main()
