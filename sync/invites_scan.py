"""מי אישר בקשת חברות, מתוך המייל של לינקדאין, בלי מודל.

20.11.2026. עד כאן הסוכן "אישר חברות" חיפש ב-Gmail דרך מחבר, חילץ שם,
תפקיד וכתובת פרופיל וקרא ל-`invites_mark.py`. אין בזה שיקול דעת: המייל
בנוי תמיד אותו דבר, ולכן אותו חילוץ יושב כאן בביטויים רגולריים, מעל
אותה גישת IMAP ש-`rejections.py` כבר משתמש בה.

הזיהוי הוא לפי הנושא "accepted your invitation". מייל "I want to connect"
מאותו שולח הוא בקשה שנכנסה אליו ולא אישור, ולכן הוא נשאר בחוץ.

    python sync/invites_scan.py --days 2          # מדפיס בלבד
    python sync/invites_scan.py --days 2 --write  # ורושם דרך invites_mark
"""
import argparse
import email
import email.header
import email.utils
import imaplib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import creds                                    # noqa: E402
from ats_mail import safe_header                                # noqa: E402

_SUBJECT = re.compile(r'accepted your invitation', re.I)
_PROFILE = re.compile(r'linkedin\.com/comm/in/([^?"\'\s<>&/]+)', re.I)
_HEADLINE = re.compile(
    r'data-test-id="pymk-entity_headline"[^>]*>\s*<td[^>]*>\s*([^<]+?)\s*</td>', re.I)


def html_of(msg):
    out = []
    for p in msg.walk():
        if p.get_content_type() == 'text/html':
            raw = p.get_payload(decode=True) or b''
            out.append(raw.decode(p.get_content_charset() or 'utf-8', 'replace'))
    return '\n'.join(out)


def display_name(raw):
    """"Revital Keren 🇮🇱 via LinkedIn" -> "Revital Keren"."""
    s = re.sub(r'\s+via\s+LinkedIn\s*$', '', raw or '', flags=re.I)
    # דגלים ואימוג'ים הם עיצוב של הפרופיל ולא חלק מהשם במסד.
    s = re.sub(r'[\U0001F000-\U0001FFFF☀-➿️‍]', '', s)
    return ' '.join(s.split())


def harvest(days):
    addr, pw = creds()
    M = imaplib.IMAP4_SSL('imap.gmail.com')
    M.login(addr, pw.replace(' ', ''))
    M.select('"[Gmail]/All Mail"', readonly=True)
    since = (datetime.utcnow() - timedelta(days=days)).strftime('%d-%b-%Y')
    typ, data = M.search(None, '(FROM "invitations@linkedin.com" SINCE %s)' % since)
    ids = data[0].split()
    print('invitation mails in the last %d days: %d' % (days, len(ids)))

    rows, seen = [], set()
    for i in ids:
        typ, d = M.fetch(i, '(BODY.PEEK[])')
        if not d or not d[0]:
            continue
        msg = email.message_from_bytes(d[0][1])
        if not _SUBJECT.search(safe_header(msg['Subject'])):
            continue
        raw_name = email.utils.parseaddr(msg['From'])[0]
        name = display_name(str(email.header.make_header(
            email.header.decode_header(raw_name))))
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        html = html_of(msg)
        m = _PROFILE.search(html)
        h = _HEADLINE.search(html)
        try:
            at = parsedate_to_datetime(msg['Date']).astimezone(timezone.utc).isoformat()
        except Exception:
            at = None
        rows.append({
            'name': name,
            'title': (h.group(1).strip() if h else '')[:120],
            'url': ('https://www.linkedin.com/in/' + m.group(1)) if m else '',
            'at': at,
        })
    M.logout()
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=2)
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args()
    rows = harvest(a.days)
    for r in rows:
        print('  %-30s %-40s %s' % (r['name'][:30], r['title'][:40], r['url'][-40:]))
    if not a.write:
        print('dry run, nothing written')
        return
    import invites_mark
    sys.argv = ['invites_mark.py', json.dumps(rows, ensure_ascii=False)]
    invites_mark.main()


if __name__ == '__main__':
    main()
