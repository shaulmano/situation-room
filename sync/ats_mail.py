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

# פענוח הנושא. **"for" הוא תפקיד ו-"to" הוא חברה**, וזה ההבדל שהפיל את
# הריצה הראשונה: "Thank you for applying to Nebius" נקרא שם כתפקיד בשם
# Nebius, ו"applying to the X role" כן מביא תפקיד. שלושה דפוסים ולא אחד.
_PAT = [
    # for the <ROLE> position at <CO>
    re.compile(r'appl\w*\s+for\s+the\s+(?P<role>.+?)\s+(?:position|role|job)\b'
               r'(?:\s+at\s+(?P<co>.+))?$', re.I),
    re.compile(r'(?:submitting|submitted)\s+your\s+resume\s+for\s+the\s+(?P<role>.+?)'
               r'\s+position\s+at\s+(?P<co>.+)$', re.I),
    # to the <ROLE> role at <CO>
    re.compile(r'appl\w*\s+to\s+the\s+(?P<role>.+?)\s+(?:position|role|job)\b'
               r'(?:\s+at\s+(?P<co>.+))?$', re.I),
    # for <ROLE> at <CO>   /   for <ROLE>
    re.compile(r'appl\w*\s+for\s+(?P<role>.+?)\s+at\s+(?P<co>.+)$', re.I),
    re.compile(r'appl\w*\s+for\s+(?P<role>.+?)$', re.I),
    # to <CO>  — חברה בלבד, בלי תפקיד
    re.compile(r'appl\w*\s+to\s+(?P<co>.+?)$', re.I),
    re.compile(r'למשרת\s+(?P<role>.+?)$'),
    re.compile(r'לתפקיד\s+(?P<role>.+?)$'),
]

# תת-דומיין שהוא אזור ולא חברה. no-reply@eu.greenhouse-mail.io אינו
# חברה בשם "eu", ו-us.greenhouse אינו "us".
_NOT_A_COMPANY = {
    'us', 'eu', 'il', 'uk', 'app', 'apps', 'mail', 'email', 'info', 'jobs', 'job',
    'careers', 'career', 'hr', 'noreply', 'no-reply', 'notifications', 'isr', 'www',
    'hire', 'hiring', 'recruit', 'recruiting', 'talent', 'web', 'smtp', 'go',
}

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


# 15.11.2026: מיילים בעברית נושאים לפעמים charset=iso-8859-8-i, הכינוי
# הלוגי של עברית ויזואלית. Python לא מכיר אותו, ו-make_header נופל
# ב-LookupError על כל התיבה בגלל הודעה אחת. הקידוד זהה ל-iso-8859-8.
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
        return raw or ''


def clean(v):
    v = (v or '').strip(' .!,-–—\u200f\u200e')
    v = re.sub(r'\s+', ' ', v)
    return v or None


def parse_subject(subject):
    """(תפקיד, חברה) מהנושא. כל אחד מהם יכול לחזור ריק."""
    s = subject.strip()
    # "We Got It: ", "Aidoc 👋 " וכו' הם קידומת ולא חלק מהתוכן.
    if ':' in s[:24]:
        s = re.sub(r'^.*?:\s*', '', s, count=1)
    s = s.replace('👋', ' ').strip()
    for pat in _PAT:
        m = pat.search(s)
        if not m:
            continue
        g = m.groupdict()
        role = clean(g.get('role'))
        co = clean(g.get('co'))
        if role:
            role = re.sub(r'^(a|an|the)\s+', '', role, flags=re.I)
            # "applying for the role of X at Y" -> X. בלי זה התפקיד יוצא
            # "role of Technical Project Manager", וזה לא שם של תפקיד.
            role = re.sub(r'^(role|position|job)\s+of\s+', '', role, flags=re.I)
            role = re.sub(r'\s+(position|role|job)$', '', role, flags=re.I)
            role = clean(role)
        # "applying for a position at X" אינו תפקיד בשם "position".
        if role and role.lower() in ('position', 'role', 'job', 'opportunity'):
            role = None
        if role and (len(role) < 3 or len(role) > 90):
            role = None
        if co and (len(co) < 2 or len(co) > 60):
            co = None
        if role or co:
            return role, co
    return None, None


def company_from(display, addr, subject_co):
    """
    שם החברה. **הנושא קודם**, כי הוא מה שהחברה עצמה כתבה.
    אחריו שם התצוגה, ורק בסוף הדומיין.
    """
    if subject_co:
        return subject_co
    host = addr.split('@')[-1]
    wrapper = next((h for h in _ATS_HOSTS if host.endswith(h)), None)
    local = addr.split('@')[0]

    if display and not _GENERIC_SENDER.match(display) and 'hiring team' not in display.lower():
        return clean(display)
    if wrapper:
        left = host[: -len(wrapper)].strip('.')
        label = left.split('.')[0] if left else ''
        if label and label.lower() not in _NOT_A_COMPANY:
            return label
        return None
    if not _GENERIC_SENDER.match(local):
        return clean(local)
    parts = host.split('.')
    label = parts[-2] if len(parts) >= 2 else host
    return None if label.lower() in _NOT_A_COMPANY else label


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
        role, subject_co = parse_subject(subject)
        found[mid] = {
            'company': company_from(display, sender, subject_co),
            'role': role,
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

    fresh, skipped, unsure = [], 0, []
    picked = set()
    for r in rows:
        ck = norm(r['company'])
        # 15.11.2026, הכלל של שאול: "אם לא בטוח תוריד אותו אני רוצה רק
        # דברים בטוחים". שורה בלי תפקיד או בלי חברה היא שורה שלא נדע
        # על מה היא, ולכן היא מודפסת ולא נרשמת. אלה בעיקר אישורים
        # גנריים של חברות השמה, "תודה על הגשת מועמדות", שלא נוקבים
        # במשרה בכלל.
        if not r['role'] or not ck:
            unsure.append(r)
            continue
        # אותה חברה, אותו תפקיד, אותו יום, בשני מיילים: הגשה אחת.
        sig = (ck, title_key(r['role']), r['sent_at'][:10])
        if sig in picked:
            skipped += 1
            continue
        picked.add(sig)
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

    print('already recorded or duplicate: %d' % skipped)
    print('dropped, no role or no company: %d' % len(unsure))
    for r in unsure:
        print('  -  %s  %-26s %s' % (r['sent_at'][:10], (r['company'] or '?')[:26],
                                     r['subject'][:52]))
    print('new: %d' % len(fresh))
    for r in fresh:
        print('  %s  %-26s %-40s %s' % (
            r['sent_at'][:10], (r['company'] or '?')[:26], (r['role'] or '')[:40],
            'linked to a job row' if r.get('job_id') else 'no job row'))

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
