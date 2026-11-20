"""מי כתב לשאול בלינקדאין, מתוך מייל ההתראה, בלי מודל ובלי המחשב.

20.11.2026. שאול: הסוכן שקורא את תיבת ההודעות רץ על המחשב שלו ועל מכסת
קלוד, ופספס תגובה ל-29 שעות כשהמחשב היה כבוי. לינקדאין שולחת מייל על כל
הודעה חדשה, `messaging-digest-noreply@linkedin.com`, בנושא "X just messaged
you", ושם התצוגה נושא את השם המלא, "Haggai Philip via LinkedIn".

**המייל אינו מכיל את תוכן ההודעה.** נמדד ב-14.11 ונשאר נכון: רק מי כתב
ומתי. לכן השורה נרשמת עם טקסט שאומר את זה בגלוי ולא ממציא תוכן, ואין
נוסח תשובה. הסוכן המלא נשאר לקריאה ולניסוח, והוא כבר לא החוליה היחידה:
העובדה שמישהו כתב מגיעה תוך שעה גם כשהוא כבוי.

**הכתיבה אינה מתנגשת בסוכן.** אותה הודעה מגיעה גם מהמייל וגם מהסוכן,
והסוכן קורא שעה לדקה והמייל מגיע שניות אחרי. השוואה רגילה של `replied_at`
הייתה פותחת מחדש כל תגובה ששאול סגר. לכן תגובה נפתחת מחדש רק כשהמייל
מאוחר ממה שרשום ב-15 דקות לפחות.

    python sync/replies_mail.py --days 2          # מדפיס בלבד
    python sync/replies_mail.py --days 2 --write
"""
import argparse
import email
import email.header
import email.utils
import imaplib
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import creds, sql, q                     # noqa: E402
from ats_mail import safe_header                         # noqa: E402
from invites_scan import display_name                    # noqa: E402

_SUBJECT = re.compile(r'just messaged you', re.I)
TEXT = ('הודעה חדשה בלינקדאין. תוכן ההודעה אינו מופיע במייל ההתראה, '
        'פתח את השיחה כדי לקרוא.')
# מייל מאוחר ממה שרשום בפחות מזה הוא אותה הודעה שנקראה פעמיים.
REOPEN_GAP = '15 minutes'


def norm(s):
    return ' '.join((s or '').split()).lower()


def harvest(days):
    addr, pw = creds()
    M = imaplib.IMAP4_SSL('imap.gmail.com')
    M.login(addr, pw.replace(' ', ''))
    M.select('"[Gmail]/All Mail"', readonly=True)
    since = (datetime.utcnow() - timedelta(days=days)).strftime('%d-%b-%Y')
    typ, data = M.search(
        None, '(FROM "messaging-digest-noreply@linkedin.com" SINCE %s)' % since)
    ids = data[0].split()
    print('message notification mails in the last %d days: %d' % (days, len(ids)))
    rows = []
    for i in ids:
        typ, d = M.fetch(i, '(BODY.PEEK[HEADER])')
        if not d or not d[0]:
            continue
        msg = email.message_from_bytes(d[0][1])
        if not _SUBJECT.search(safe_header(msg['Subject'])):
            continue
        raw = email.utils.parseaddr(msg['From'])[0]
        name = display_name(str(email.header.make_header(
            email.header.decode_header(raw))))
        try:
            at = parsedate_to_datetime(msg['Date']).astimezone(timezone.utc)
        except Exception:
            continue
        if name:
            rows.append({'name': name, 'at': at})
    M.logout()
    rows.sort(key=lambda r: r['at'])
    return rows


def pick(name, known):
    """איש הקשר שכתב. שם אינו מזהה, ולכן קודם מי ששאול כבר פנה אליו."""
    key = norm(name)
    hits = [c for c in known if norm(c['full_name']) == key]
    if not hits:
        # "Tamara Elimelech (תמרה אלימלך)" בייצוא מול "Tamara Elimelech" במייל.
        hits = [c for c in known
                if norm(re.sub(r'\([^)]*\)', '', c['full_name'] or '')) == key]
    if not hits:
        return None, 0
    reached = [c for c in hits if c.get('reached')]
    return (reached or hits)[0], len(hits)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=2)
    ap.add_argument('--write', action='store_true')
    # רישום בלבד, בלי באנר ובלי פוש. להרצה הראשונה: המייל אינו יודע ששאול
    # כבר ענה, ובלי זה כל שיחה שהוא טיפל בה בימים האחרונים הייתה חוזרת.
    ap.add_argument('--seen', action='store_true')
    a = ap.parse_args()
    rows = harvest(a.days)
    for r in rows:
        print('  %s  %s' % (r['at'].strftime('%d.%m %H:%M'), r['name'][:40]))
    if not a.write:
        print('dry run, nothing written')
        return

    known = sql(
        "select id, full_name, "
        "(contacted_at is not null or first_pitch_at is not null "
        " or wide_sent_at is not null) as reached "
        "from contacts where coalesce(full_name,'') <> ''")
    recorded = created = 0
    for r in rows:
        who, n = pick(r['name'], known)
        if n > 1:
            print('  %d contacts share this name, took %s: %s' % (
                n, 'the one he reached out to' if who.get('reached')
                else 'the first row', r['name'][:40]))
        if not who:
            # אדם שכתב לשאול בעצמו ואינו באנשי הקשר נשמר, כמו ב-
            # replies_mark: אף אחד לא נגרד, ויש ביניהם שיחה פתוחה.
            new = sql(
                "insert into contacts (full_name, source, note) "
                "values (%s, 'inbound', %s) returning id"
                % (q(r['name'][:120]),
                   q('כתב לשאול בלינקדאין ולא היה באנשי הקשר. '
                     'נוצר אוטומטית ממייל ההתראה.')))
            if not new:
                print('  could not create contact: %s' % r['name'][:40])
                continue
            who = {'id': new[0]['id'], 'full_name': r['name']}
            known.append({'id': who['id'], 'full_name': r['name'],
                          'reached': False})
            created += 1
            print('  created from an inbound message: %s' % r['name'][:40])
        at = 'least(%s::timestamptz, now())' % q(r['at'].isoformat())
        changed = sql(
            ("update contacts set replied_at = {at}, reply_text = {txt}, "
             "reply_draft = null, reply_done_at = {closed}, reply_pushed_at = {closed} "
             "where id = {cid} and (replied_at is null "
             "or {at} > replied_at + interval '" + REOPEN_GAP + "') "
             "returning id").format(at=at, txt=q(TEXT), cid=q(who['id']),
                    closed='now()' if a.seen else 'null'))
        if changed:
            recorded += 1
            print('  recorded: %s' % r['name'][:40])
        else:
            print('  already known, left as is: %s' % r['name'][:40])
    print('recorded %d' % recorded)
    if created:
        print('(%d new contacts created)' % created)


if __name__ == '__main__':
    main()
