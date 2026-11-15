"""
הגשות שנעשו ישירות באתר החברה, מתוך מייל האישור.

15.11.2026. שאול ראה משרות שהוא כבר הגיש אליהן, ואמר "כן הגשתי להם אבל
לא דרכנו". נמדד מול התיבה: בשלושים יום נכנסו 31 מיילי אישור, ו**שלושה**
מהם, כולם מהבוקר ההוא בתוך חמש דקות, לא היו במסד בכלל: Xsight Labs,
Dream ו-Ori Sandbox.

**הסיבה: `gmail_sync.py` קורא רק את לינקדאין.** השאילתה שלו היא
`FROM jobs-noreply@linkedin.com SUBJECT "your application was sent to"`,
כלומר Easy Apply בלבד. הגשה ישירה באתר חברה מחזירה אישור מ-Comeet,
מ-Greenhouse, מ-Workday או מ-Ashby, ואף אחד מהם לא נקרא. זאת הפעם השישית
שאותו דפוס חוזר: מידע עבר במערכת ונזרק. התיאור עד 2.11, `found_for` עד
10.11, המפרסם עד 13.11, כתובת המייל בתוך תגובה עד 14.11, המשרה שכתבת
עליה עד 15.11, וזה.

**למה בענן ולא דרך קלוד.** ל-`cv.yml` כבר יש `GMAIL_ADDRESS` ו-
`GMAIL_APP_PASSWORD`, אותם סודות ששאול הכניס בעצמו ב-13.11, ולכן הריצה
לא תלויה במחשב ולא בשיחה פתוחה. זה גם מה שהוא ביקש: שום סוכן מקומי.

**ברירת המחדל היא לא לכתוב.** `--write` כותב. 556 ההגשות הן המכנה של
"0.4 אחוז להגשה קרה", ולכן שורה שגויה כאן מזייפת את המספר שכל חדר המצב
נשען עליו. מסלול שכותב בשקט גם כשלא באמת זיהה הוא בדיוק סוג השקט שהפיל
כאן דברים לאורך כל 2026.

    python sync/ats_mail.py            # מדפיס מה היה נרשם
    python sync/ats_mail.py --write    # רושם
    python sync/ats_mail.py --days 60  # חלון אחר, ברירת המחדל 30
"""
import codecs
import email
import imaplib
import os
import re
import sys
from datetime import datetime, timedelta
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import creds, sql, q   # noqa: E402

# נושאים שמעידים על הגשה. דחייה נספרת גם היא: "we decided to move forward
# with other candidates" מוכיח שהייתה הגשה, וזה כל מה שאנחנו מחפשים כאן.
_SUBJECT_OK = [
    'thanks for applying', 'thank you for applying', 'thanks for your application',
    'thank you for your application', 'received your application', 'application received',
    'thanks for submitting', 'thank you for submitting',
    'קיבלנו את קורות החיים', 'קבלנו את קורות החיים', 'קיבלנו את מועמדותך',
    'תודה על הגשת מועמדות', 'תודה על הגשת המועמדות',
]

# שולחים שהם מעטפת ATS ולא החברה. השם של החברה יושב אז בתת-הדומיין
# (no-reply@xsightlabs.comeet-notifications.com) או בנושא.
_ATS_HOSTS = [
    'comeet-notifications.com', 'greenhouse-mail.io', 'ashbyhq.com', 'myworkday.com',
    'sparkhire.com', 'comeet.co', 'workable.com', 'lever.co', 'smartrecruiters.com',
    'icims.com', 'successfactors.com', 'jobvite.com',
]

# שמות תיבה גנריים: "no-reply", "Xsight Labs hiring team". אלה לא שם חברה.
_GENERIC_SENDER = re.compile(
    r'^(no[- ]?reply|do[- ]?not[- ]?reply|notifications?|careers?|jobs?|hr|recruit\w*|'
    r'talent|hiring( team)?|mail|info|apply)$', re.I)

# "...for the <ROLE> position at <CO>", "...for <ROLE>", "...to the <ROLE> role"
_ROLE_PATTERNS = [
    re.compile(r'appl\w*\s+(?:for|to)\s+the\s+(.+?)\s+(?:position|role|job)\b', re.I),
    re.compile(r'(?:submitting|submitted)\s+your\s+resume\s+for\s+the\s+(.+?)\s+position\b', re.I),
    re.compile(r'appl\w*\s+(?:for|to)\s+the\s+(.+?)(?:\s+at\s+.+)?$', re.I),
    re.compile(r'appl\w*\s+(?:for|to)\s+(?:a\s+position\s+at\s+.+|)(.+?)(?:\s+at\s+.+)?$', re.I),
    re.compile(r'למשרת\s+(.+?)\s*$'),
    re.compile(r'לתפקיד\s+(.+?)\s*$'),
]

_AT_COMPANY = re.compile(r'\bat\s+([A-Z0-9][^,!|]*?)\s*$')


# 15.11.2026: מיילים בעברית נושאים לפעמים `charset=iso-8859-8-i`, שזה
# הכינוי הלוגי של עברית ויזואלית. Python לא מכיר אותו ו-`make_header`
# נופל ב-LookupError על כל התיבה בגלל הודעה אחת. הקידוד עצמו זהה
# ל-iso-8859-8, ולכן זאת רק רישום של השם.
codecs.register(
    lambda name: codecs.lookup('iso-8859-8')
    if name.replace('_', '-').lower() in ('iso-8859-8-i', 'iso-8859-8-e')
    else None
)


def safe_header(raw):
    """כותרת מפוענחת, ולעולם לא חריגה: קידוד אחד לא תקין לא מפיל סריקה."""
    try:
        return str(make_header(decode_header(raw or '')))
    except Exception:
        return (raw or '')


def norm(s):
    """אותו צמצום של contacts.companyKey בצד הטייפסקריפט: אותיות וספרות בלבד."""
    flat = re.sub(r'[^0-9A-Za-z֐-׿]+', '', (s or '').lower())
    return re.sub(r'(ltd|limited|inc|llc|corp|gmbh|בעמ)$', '', flat)


def title_key(s):
    return re.sub(r'\s+', ' ', re.sub(r'[^0-9A-Za-z֐-׿]+', ' ', (s or '').lower())).strip()


def sender_parts(raw):
    """(שם תצוגה, כתובת) מתוך הכותרת From."""
    name, addr = email.utils.parseaddr(raw or '')
    return safe_header(name).strip(), (addr or '').lower()


def company_from(display, addr, subject):
    """
    שם החברה, לפי שלושה מקורות ובסדר הזה.

    **הנושא קודם לשולח**, כי "at Workday" בנושא מדויק יותר מ-
    `workday@myworkday.com`, ששם הוא גם הספק וגם החברה במקרה היחיד הזה.
    """
    m = _AT_COMPANY.search(subject.strip().rstrip('!'))
    if m:
        name = m.group(1).strip()
        if 2 <= len(name) <= 60:
            return name

    host = addr.split('@')[-1]
    wrapper = next((h for h in _ATS_HOSTS if host.endswith(h)), None)

    local = addr.split('@')[0]
    if display and not _GENERIC_SENDER.match(display) and 'hiring team' not in display.lower():
        return display
    if wrapper:
        # xsightlabs.comeet-notifications.com -> xsightlabs
        left = host[: -len(wrapper)].strip('.')
        if left:
            return left.split('.')[0]
    if not wrapper and not _GENERIC_SENDER.match(local):
        return local
    # הדומיין עצמו, בלי הסיומת: aidoc.com -> aidoc
    parts = host.split('.')
    return parts[-2] if len(parts) >= 2 else host


def role_from(subject):
    s = subject.strip()
    # "We Got It: " ודומיו הם קידומת ולא חלק מהתפקיד.
    s = re.sub(r'^.*?:\s*', '', s, count=1) if ':' in s[:20] else s
    s = s.replace('👋', ' ')
    for pat in _ROLE_PATTERNS:
        m = pat.search(s)
        if not m:
            continue
        role = m.group(1).strip(' .!-–—')
        role = re.sub(r'^(a|an|the)\s+', '', role, flags=re.I)
        role = re.sub(r'\s+(position|role|job)$', '', role, flags=re.I)
        # "a position" הוא אישור בלי תפקיד, ולא תפקיד בשם הזה.
        if role.lower() in ('position', 'a position', 'role', '') or len(role) > 90:
            return None
        if len(role) >= 3:
            return role
    return None


def looks_like_confirmation(subject):
    low = subject.lower()
    return any(k in low for k in _SUBJECT_OK)


def harvest(days):
    addr, pw = creds()
    M = imaplib.IMAP4_SSL('imap.gmail.com')
    M.login(addr, pw.replace(' ', ''))
    M.select('"[Gmail]/All Mail"', readonly=True)

    since = (datetime.utcnow() - timedelta(days=days)).strftime('%d-%b-%Y')
    # לינקדאין מטופל ב-gmail_sync, ושורה כפולה משם היא בדיוק מה שמזייף
    # את המכנה. NOT FROM מוציא אותו כאן.
    typ, data = M.search(None, '(SINCE %s NOT FROM "linkedin.com")' % since)
    ids = data[0].split()
    print('scanned window: %d days, %d messages' % (days, len(ids)))

    found = {}
    for i in ids:
        typ, d = M.fetch(i, '(BODY.PEEK[HEADER])')
        if not d or not d[0]:
            continue
        msg = email.message_from_bytes(d[0][1])
        subject = safe_header(msg['Subject'])
        if not looks_like_confirmation(subject):
            continue
        display, sender = sender_parts(msg['From'])
        # מייל שהוא עצמו שלח אינו אישור קבלה.
        if addr.lower() in sender:
            continue
        try:
            when = parsedate_to_datetime(msg['Date']).isoformat()
        except Exception:
            continue
        mid = (msg['Message-ID'] or '').strip('<> ')
        if not mid:
            continue
        found[mid] = {
            'company': company_from(display, sender, subject),
            'role': role_from(subject),
            'sent_at': when,
            'subject': subject,
            'sender': sender,
            'key': 'ats:' + mid[:120],
        }
    M.logout()
    return list(found.values())


def main():
    write = '--write' in sys.argv
    days = 30
    if '--days' in sys.argv:
        days = int(sys.argv[sys.argv.index('--days') + 1])

    rows = harvest(days)
    rows.sort(key=lambda r: r['sent_at'], reverse=True)
    print('confirmation mails: %d' % len(rows))
    if not rows:
        print('nothing to do')
        return

    # מה שכבר רשום. ההשוואה היא לפי חברה, ואז לפי כותרת, בדיוק כמו
    # בצד התצוגה. בלי זה כל הגשה שהוא סימן בכפתור הייתה נספרת פעמיים.
    have = sql("select company, role, sent_at, gmail_thread_id from applications "
               "where sent_at > now() - interval '%d days';" % (days + 7))
    by_company = {}
    for a in have or []:
        by_company.setdefault(norm(a.get('company')), []).append(a)
    seen_threads = {a.get('gmail_thread_id') for a in have or []}

    # המשרות הפתוחות, לקישור. הגשה שמוצמדת למשרה יורדת מרשימת הלידים,
    # וזאת כל הסיבה שהוא ביקש את זה.
    jobs = sql("select id, title, company from jobs "
               "where first_seen > now() - interval '120 days';") or []
    by_posting = {}
    for j in jobs:
        by_posting.setdefault(norm(j.get('company')) + '|' + title_key(j.get('title')), j['id'])

    fresh, skipped = [], 0
    for r in rows:
        ck = norm(r['company'])
        if r['key'] in seen_threads:
            skipped += 1
            continue
        # אותה חברה ואותה כותרת בשבועיים סביב התאריך היא אותה הגשה, גם אם
        # היא נרשמה בכפתור ולא כאן.
        dup = False
        for a in by_company.get(ck, []):
            same_role = title_key(a.get('role')) == title_key(r['role']) if r['role'] else True
            if not same_role:
                continue
            try:
                gap = abs((parsedate_to_datetime(email.utils.format_datetime(
                    datetime.fromisoformat(a['sent_at'].replace('Z', '+00:00'))))
                    - datetime.fromisoformat(r['sent_at'])).days)
            except Exception:
                gap = 0
            if gap <= 14:
                dup = True
                break
        if dup:
            skipped += 1
            continue
        r['job_id'] = by_posting.get(ck + '|' + title_key(r['role'])) if r['role'] else None
        fresh.append(r)

    print('already recorded: %d' % skipped)
    print('new: %d' % len(fresh))
    for r in fresh:
        print('  %s  %-28s %-42s %s' % (
            r['sent_at'][:10], (r['company'] or '?')[:28],
            (r['role'] or '(תפקיד לא נקרא מהנושא)')[:42],
            'linked' if r.get('job_id') else 'no job row'))

    if not write:
        print('\ndry run. nothing written. run with --write to record.')
        return

    for r in fresh:
        sql("insert into applications "
            "(job_id, company, role, channel, gmail_thread_id, sent_at, status, status_by) "
            "values (%s, %s, %s, 'form', %s, %s, 'sent', 'auto') "
            "on conflict (gmail_thread_id) do nothing;"
            % (q(r.get('job_id')), q(r['company']), q(r['role']),
               q(r['key']), q(r['sent_at'])))
    print('recorded: %d' % len(fresh))


if __name__ == '__main__':
    main()
