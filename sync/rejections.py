"""
דחיות: מי החליט לא להמשיך, מתוך המייל.

17.11.2026. שאול: **"אני רוצה שמשרות שהגשתי אליהם וחזרו אלי במייל שהחליטו
לא להמשיך בתהליך שתסמן אותן בטאב הגשה ובדף עצמו יהיה גם פילטר לפי נדחו."**

נמדד מול התיבה לפני שנכתבה שורה: בתשעים יום, 28 מתוך 30 התוצאות הראשונות
היו דחיות אמיתיות. Majestic Labs, Dream, Buildots, Similarweb, D-Fend,
Sidelines, AT&T, Zip, Gett, פמה, Orca-AI, Jeen.ai, Moveo, Nebius, JLL,
Final, Akamai, Wolt, Sentrycs, NVIDIA, Alice, Ceva, הראל, LTS, Mobileye,
Airobotics. השתיים שאינן היו דיוור של Glassdoor.

**הסטטוס כבר קיים ואין צורך בעמודה.** `applications.status` מחזיק
`rejected` מאז 0008, `LABEL` במסך ההגשות כבר מרנדר "נדחה" באדום,
והסינון `?status=rejected` כבר עובד. מה שחסר היה מי כותב אותו.

**והזיהוי הוא בגוף ולא בנושא.** זאת הנקודה שמפילה את הגישה הנאיבית:
"Thank you for applying for the Technical Project Manager position at
Sidelines" היה **דחייה**, ואותו נושא בדיוק משמש גם לאישור קבלה. לכן
`ats_mail.py` מזהה הגשה לפי הנושא, וכאן נקרא הגוף.

**ברירת המחדל היא לא לכתוב**, כמו ב-`ats_mail.py` ומאותה סיבה: 556
ההגשות הן המכנה של "0.4 אחוז להגשה קרה", ושורה שגויה כאן מזייפת את
המספר שכל חדר המצב נשען עליו.

    python sync/rejections.py             # מדפיס מה היה נרשם
    python sync/rejections.py --write     # רושם
    python sync/rejections.py --days 120  # חלון אחר, ברירת המחדל 60
"""
import email
import imaplib
import os
import re
import sys
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import creds, sql, q                      # noqa: E402
from ats_mail import (                                    # noqa: E402
    company_from, norm, parse_subject, safe_header, sender_parts, title_key,
)

# הנוסחים שמעידים על דחייה, מתוך 28 המיילים שנמדדו. **רשימה מפורשת ולא
# מילה בודדת**: "unfortunately" לבדה מופיעה גם במיילים שאינם דחייה, ו-
# "other candidates" בלי הקשר מופיעה בדיוורי גיוס.
_REJECT = [
    'not to move forward', 'not moving forward', "won't be moving forward",
    'will not be moving forward', 'not be moving forward',
    'move forward with other', 'moving forward with other',
    'proceed with other', 'decided to proceed with other',
    'not to proceed', 'decided not to continue', 'not be proceeding',
    'regret to inform', 'not been selected', 'not selected for',
    'any further', 'no longer open', 'no longer available',
    'not a match at this time', 'other candidates whose',
    'alignment between your', 'decided to move ahead with other',
    'pursue other candidates', 'moving ahead with other',
    'מועמדים אחרים', 'להתקדם עם מועמדים', 'לא נמשיך', 'לא להמשיך',
    'לצערנו לא', 'אינך מתאים', 'איננו ממשיכים', 'הוחלט להתקדם עם',
]

# נושאים שלא שווה בכלל לפתוח את הגוף שלהם. דיוורים, התראות, חדשות.
_SKIP_SENDER = re.compile(
    r'(glassdoor|indeed|linkedin|facebook|twitter|medium|substack|newsletter|'
    r'billing|invoice|receipt|noreply@google|calendar)', re.I)

# רק מייל שנראה קשור למועמדות נפתח. בלי זה הסריקה קוראת גוף של כל מייל
# בתיבה, וזאת עבודה מיותרת על אלפי הודעות.
_MAYBE = re.compile(
    r'(appl\w*|position|\brole\b|candidat\w*|interest in|resume|cv\b|hiring|'
    r'recruit\w*|opportunit\w*|update from|regarding your|thank you for|'
    r'מועמדות|מועמדותך|משרה|משרת|תפקיד|גיוס|קורות חיים)', re.I)


def body_text(msg):
    """הטקסט של ההודעה, HTML כולל, מצומצם לטקסט פשוט."""
    parts = []
    if msg.is_multipart():
        for p in msg.walk():
            if p.get_content_type() in ('text/plain', 'text/html'):
                try:
                    parts.append(p.get_payload(decode=True) or b'')
                except Exception:
                    continue
    else:
        try:
            parts.append(msg.get_payload(decode=True) or b'')
        except Exception:
            pass
    raw = b'\n'.join(parts)
    for enc in ('utf-8', 'iso-8859-8', 'windows-1255', 'latin-1'):
        try:
            txt = raw.decode(enc)
            break
        except Exception:
            continue
    else:
        return ''
    txt = re.sub(r'<[^>]+>', ' ', txt)
    txt = txt.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&#39;', "'")
    txt = txt.replace('’', "'").replace('‘', "'")
    return re.sub(r'\s+', ' ', txt)


def is_rejection(text):
    low = text.lower()
    return next((p for p in _REJECT if p in low), None)


def harvest(days):
    addr, pw = creds()
    M = imaplib.IMAP4_SSL('imap.gmail.com')
    M.login(addr, pw.replace(' ', ''))
    M.select('"[Gmail]/All Mail"', readonly=True)

    since = (datetime.utcnow() - timedelta(days=days)).strftime('%d-%b-%Y')
    typ, data = M.search(None, '(SINCE %s)' % since)
    ids = data[0].split()
    print('scanned window: %d days, %d messages' % (days, len(ids)))

    out, opened = [], 0
    for i in ids:
        typ, d = M.fetch(i, '(BODY.PEEK[HEADER])')
        if not d or not d[0]:
            continue
        head = email.message_from_bytes(d[0][1])
        subject = safe_header(head['Subject'])
        display, sender = sender_parts(head['From'])
        if addr.lower() in sender or _SKIP_SENDER.search(sender):
            continue
        if not _MAYBE.search(subject):
            continue

        typ, d2 = M.fetch(i, '(BODY.PEEK[])')
        if not d2 or not d2[0]:
            continue
        opened += 1
        msg = email.message_from_bytes(d2[0][1])
        phrase = is_rejection(body_text(msg))
        if not phrase:
            continue
        try:
            when = parsedate_to_datetime(msg['Date']).isoformat()
        except Exception:
            continue
        role, subject_co = parse_subject(subject)
        out.append({
            'company': company_from(display, sender, subject_co),
            'role': role,
            'at': when,
            'subject': subject,
            'sender': sender,
            'phrase': phrase,
        })
    M.logout()
    print('opened bodies: %d, rejections found: %d' % (opened, len(out)))
    return out


def applications():
    rows = sql("select a.id, a.status, a.company, a.role, a.sent_at, "
               "j.company jc, j.title jt from applications a "
               "left join jobs j on j.id = a.job_id") or []
    for r in rows:
        r['ck'] = norm(r.get('company') or r.get('jc'))
        r['tk'] = title_key(r.get('role') or r.get('jt'))
    return rows


def match(rej, apps):
    """
    ההגשה שהדחייה הזאת מדברת עליה, או None.

    **שתי רמות, ושתיהן שמרניות.** חברה וגם תפקיד היא התאמה. חברה בלבד
    מתקבלת רק כשיש בדיוק הגשה אחת פתוחה באותה חברה: שתי הגשות לאותה
    חברה ודחייה שלא נוקבת בתפקיד אינן אומרות לנו איזו מהן נדחתה, וניחוש
    שם מסמן משרה חיה כמתה.
    """
    ck = norm(rej['company'])
    if not ck:
        return None, 'no company'
    tk = title_key(rej['role'])
    same_co = [a for a in apps if a['ck'] == ck]
    if not same_co:
        return None, 'company not in applications'

    if tk:
        exact = [a for a in same_co if a['tk'] == tk]
        if len(exact) == 1:
            return exact[0], 'company + title'
        if len(exact) > 1:
            # אותה חברה ואותו תפקיד פעמיים: הישנה ביותר היא זאת שנדחתה
            # ראשונה, ואין דרך לדעת. נדחה את ההכרעה.
            return None, 'two applications with the same title'
        near = [a for a in same_co
                if a['tk'] and (a['tk'] in tk or tk in a['tk'])]
        if len(near) == 1:
            return near[0], 'company + contained title'

    open_ones = [a for a in same_co if a['status'] not in ('rejected',)]
    if len(open_ones) == 1:
        return open_ones[0], 'only application at this company'
    return None, 'company matches %d applications, title did not decide' % len(same_co)


def main():
    days = 60
    write = '--write' in sys.argv
    if '--days' in sys.argv:
        days = int(sys.argv[sys.argv.index('--days') + 1])

    rejects = harvest(days)
    apps = applications()
    print('applications on file: %d' % len(apps))

    hit, already, miss = [], 0, []
    for r in rejects:
        a, why = match(r, apps)
        if not a:
            miss.append((r, why))
            continue
        if a['status'] == 'rejected':
            already += 1
            continue
        hit.append((r, a, why))

    print()
    for r, a, why in hit:
        print('  %-26s %-40s  <- %s' % ((a['company'] or '')[:26],
                                        (a['role'] or '')[:40], why))
    print()
    print('to mark: %d, already rejected: %d, unmatched: %d'
          % (len(hit), already, len(miss)))
    if miss:
        print()
        print('unmatched, for the record:')
        for r, why in miss[:30]:
            print('  %-24s %-34s  %s' % ((r['company'] or '?')[:24],
                                         (r['role'] or '?')[:34], why))

    if not write:
        print()
        print('dry run. nothing written. add --write to record.')
        return
    for r, a, why in hit:
        sql("update applications set status = 'rejected', "
            "note = coalesce(nullif(note, ''), %s) where id = %s"
            % (q('נדחה במייל ' + r['at'][:10]), q(a['id'])))
    print('recorded %d' % len(hit))


if __name__ == '__main__':
    main()
