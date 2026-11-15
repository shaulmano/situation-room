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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q           # noqa: E402
from replies_mark import norm           # noqa: E402


def slug_of(url):
    """הזהות של פרופיל לינקדאין: מה שאחרי /in/, בלי פרמטרים."""
    u = (url or '').strip().lower().rstrip('/')
    if not u:
        return ''
    if '/in/' in u:
        u = u.split('/in/')[-1]
    u = u.split('?')[0].split('#')[0].strip('/')
    return u if u and '/' not in u else ''


def looks_like_profile(s):
    s = (s or '').strip()
    return 'linkedin.com' in s.lower() or ('/in/' in s) or (
        ' ' not in s and '-' in s and len(s) > 5)


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    try:
        names = json.loads(raw or '[]')
    except ValueError as e:
        raise SystemExit('bad JSON: %s' % e)
    if not isinstance(names, list):
        raise SystemExit('expected a list of names')

    print('conversation names in: %d' % len(names))
    if not names:
        print('nothing to do')
        return

    known = sql("select id, full_name, linkedin_url, li_seen_at from contacts") or []
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
    for n in names:
        key = str(n).strip()
        # קישור פרופיל או slug מצליבים בוודאות, ושם מצליב בקירוב. שתי
        # הצורות מתקבלות באותו קלט כדי שלא יהיו שני מצבים לתחזק.
        who = by_slug.get(slug_of(key)) if looks_like_profile(key) else None
        if who is None:
            who = by_name.get(norm(key))
        if not who:
            miss += 1
            continue
        if who.get('li_seen_at'):
            already += 1
            continue
        ids.append(who['id'])
        hit += 1

    # Batched, because a full sweep can carry hundreds of names.
    for i in range(0, len(ids), 200):
        chunk = ids[i:i + 200]
        sql("update contacts set li_seen_at = now() where id in (%s)"
            % ','.join(q(x) for x in chunk))

    print('marked %d, already marked %d, not in contacts %d' % (hit, already, miss))


if __name__ == '__main__':
    main()
