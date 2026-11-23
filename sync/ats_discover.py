"""מוצא לכל חברה ברשימה באיזו מערכת גיוס היא מפרסמת, ורושם ב-company_ats.

23.11.2026. הרשימה (companies) מחזיקה 5,453 חברות, ולרובן אין שום מקור
סריקה. הבדיקה כאן היא קריאה ציבורית אחת לכל צירוף של טוקן ופלטפורמה, אותם
עמודי קריירה ציבוריים שהמערכת כבר קוראת. טוקן שגוי מחזיר 404 מיד.

    python sync/ats_discover.py --sizes M,E --limit 1500 --write
"""
import argparse
import concurrent.futures
import json
import os
import re
import sys
import urllib.request
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cv_requests import sql, summary, q

ISRAEL = ('israel', 'tel aviv', 'tel-aviv', 'herzliya', 'raanana', "ra'anana",
          'haifa', 'jerusalem', 'netanya', 'petah', 'rehovot', 'beer sheva',
          'yokneam', 'caesarea', 'ramat gan', 'hod hasharon', 'kfar saba')


def get(url, timeout=8):
    req = urllib.request.Request(url, headers={'User-Agent': 'situation-room/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8', 'replace'))


def _il(rows, loc_of):
    return sum(1 for r in rows if any(c in (loc_of(r) or '').lower() for c in ISRAEL))


def t_greenhouse(tok):
    rows = get(f'https://boards-api.greenhouse.io/v1/boards/{tok}/jobs').get('jobs') or []
    return len(rows), _il(rows, lambda r: (r.get('location') or {}).get('name'))


def t_lever(tok):
    rows = get(f'https://api.lever.co/v0/postings/{tok}?mode=json')
    if not isinstance(rows, list):
        raise ValueError('not a list')
    return len(rows), _il(rows, lambda r: (r.get('categories') or {}).get('location'))


def t_ashby(tok):
    rows = get(f'https://api.ashbyhq.com/posting-api/job-board/{tok}').get('jobs') or []
    return len(rows), _il(rows, lambda r: r.get('location'))


def t_smartrecruiters(tok):
    rows = get(f'https://api.smartrecruiters.com/v1/companies/{tok}/postings?limit=100').get('content') or []
    return len(rows), _il(rows, lambda r: '%s %s' % ((r.get('location') or {}).get('city', ''),
                                                     (r.get('location') or {}).get('country', '')))


PLATFORMS = [('greenhouse', t_greenhouse), ('lever', t_lever),
             ('ashby', t_ashby), ('smartrecruiters', t_smartrecruiters)]

_SUFFIX = re.compile(r'\b(ltd|inc|llc|limited|technologies|technology|tech|israel|group|systems|solutions|labs)\b')


def slugs(name, website):
    out = []
    base = re.sub(r'[^a-z0-9 ]', ' ', (name or '').lower())
    base = re.sub(r'\s+', ' ', base).strip()
    for b in {base, _SUFFIX.sub('', base).strip()}:
        if not b:
            continue
        out += [b.replace(' ', ''), b.replace(' ', '-')]
        out.append(b.split()[0])
    if website:
        host = urlparse(website if '//' in website else '//' + website).netloc.lower()
        host = re.sub(r'^www\.', '', host)
        label = host.split('.')[0]
        if label:
            out.append(label)
    seen, res = set(), []
    for s in out:
        if len(s) > 2 and s not in seen:
            seen.add(s)
            res.append(s)
    return res[:5]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sizes', default='M,E')
    ap.add_argument('--limit', type=int, default=1500)
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args()
    sizes = ",".join(q(x.strip()) for x in a.sizes.split(','))
    comps = sql(f"select id, name, website from companies where size_class in ({sizes}) "
                f"and id not in (select company_id from company_ats) order by id limit {int(a.limit)}")
    work = []
    for c in comps:
        for tok in slugs(c['name'], c.get('website')):
            for pf, fn in PLATFORMS:
                work.append((c, pf, fn, tok))
    summary(f'companies {len(comps)}, requests {len(work)}')

    def probe(w):
        c, pf, fn, tok = w
        try:
            total, il = fn(tok)
        except Exception:
            return None
        return c, pf, tok, total, il

    found = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as ex:
        for r in ex.map(probe, work):
            if r:
                found.append(r)
    # שם גנרי ("next", "run") עשוי לענות עבור חברה אחרת. רק לוח עם משרות
    # בישראל נשמר, וגם הוא מדווח עם שם החברה כדי שאפשר יהיה לבדוק.
    keep = [r for r in found if r[4] > 0]
    by_pf = {}
    for c, pf, tok, total, il in keep:
        by_pf.setdefault(pf, []).append((c['name'], tok, total, il))
    cos = len({r[0]['id'] for r in keep})
    summary(f'answered {len(found)}, with Israel postings {len(keep)}, companies {cos}, '
            f'Israel postings total {sum(r[4] for r in keep)}')
    for pf, rows in by_pf.items():
        summary(f'== {pf}: {len(rows)} boards, {sum(r[3] for r in rows)} Israel postings')
        for n, tok, total, il in sorted(rows, key=lambda r: -r[3])[:15]:
            summary(f'  {n} [{tok}] {il}/{total}')
    if a.write and keep:
        vals = ",".join(f"({q(r[0]['id'])},{q(r[1])},{q(r[2])},{int(r[3])},{int(r[4])})" for r in keep)
        sql("insert into company_ats (company_id, platform, token, postings, il_postings) values "
            + vals + " on conflict (company_id, platform, token) do update set postings=excluded.postings, "
            "il_postings=excluded.il_postings, checked_at=now()")
        summary(f'wrote {len(keep)}')


if __name__ == '__main__':
    main()
