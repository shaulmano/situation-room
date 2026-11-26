"""פיילוט CRM: כמה משרות אפשר למצוא לפי חברה של איש קשר. קריאה בלבד.

26.11.2026. לא כותב לשום טבלה ולא נוגע ב-jobs. לוקח מדגם דטרמיניסטי של חברות
מאנשי קשר שנראים כמגייסים או HR, בודק לוחות ציבוריים (Greenhouse, Lever, Ashby,
SmartRecruiters) וסופר משרות בישראל ומשרות בתפקידי המטרה.

    python sync/crm_pilot.py 100
"""
import concurrent.futures
import json
import os
import re
import sys
import urllib.request
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cv_requests import sql, summary
from ats_discover import slugs, ISRAEL

TARGET = re.compile(r'project manager|program manager|delivery|release manager|pmo|\bqa\b|quality|'
                    r'test(ing)? (manager|lead)|head of (qa|delivery|program|project)|'
                    r'director.*(qa|quality|delivery|program)|technical program', re.I)


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'situation-room/1.0'})
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read().decode('utf-8', 'replace'))


def greenhouse(t):
    return [(j.get('title', ''), (j.get('location') or {}).get('name', ''))
            for j in get(f'https://boards-api.greenhouse.io/v1/boards/{t}/jobs').get('jobs') or []]


def lever(t):
    rows = get(f'https://api.lever.co/v0/postings/{t}?mode=json')
    if not isinstance(rows, list):
        raise ValueError
    return [(j.get('text', ''), (j.get('categories') or {}).get('location', '')) for j in rows]


def ashby(t):
    return [(j.get('title', ''), j.get('location', ''))
            for j in get(f'https://api.ashbyhq.com/posting-api/job-board/{t}').get('jobs') or []]


def smart(t):
    rows = get(f'https://api.smartrecruiters.com/v1/companies/{t}/postings?limit=100').get('content') or []
    return [(j.get('name', ''), '%s %s' % ((j.get('location') or {}).get('city', ''),
                                           (j.get('location') or {}).get('country', ''))) for j in rows]


PF = [('greenhouse', greenhouse), ('lever', lever), ('ashby', ashby), ('smartrecruiters', smart)]


def probe(c):
    toks = slugs(c['name'], c.get('website'))
    for tok in toks:
        for pf, fn in PF:
            try:
                rows = fn(tok)
            except Exception:
                continue
            il = [r for r in rows if any(k in (r[1] or '').lower() for k in ISRAEL)]
            if il:
                tgt = [r[0] for r in il if TARGET.search(r[0] or '')]
                return dict(c, platform=pf, token=tok, total=len(rows), il=len(il), target=tgt)
    return dict(c, platform=None, token='', total=0, il=0, target=[])


LEGAL = re.compile(r"(ltd|limited|inc|incorporated|llc|corp|corporation|gmbh|בעמ)$")


def key(name):
    return LEGAL.sub("", re.sub(r"[\W_]+", "", (name or "").lower()))


def cover():
    """משרות מתאימות פתוחות מול אנשי קשר באותה חברה. קריאה בלבד."""
    jobs = sql("select id, title, company from jobs where on_target and dismissed_at is null "
               "and closed_at is null and first_seen > now() - interval '30 days'")
    try:
        applied = {r['job_id'] for r in sql("select job_id from applications")}
    except Exception:
        applied = set()
    al = {r['alias_key']: r['company_key'] for r in sql("select alias_key, company_key from company_aliases")}
    cts = sql("select company_key, title, left_company_at from contacts where company_key is not null and company_key<>''")
    rec = re.compile(r'recruit|talent|hr |human resources|acquisition|גיוס|משאבי אנוש', re.I)
    dev = re.compile(r'cto|vp r&d|vp eng|head of (r&d|eng)|engineering manager|פיתוח', re.I)
    by = {}
    for c in cts:
        if c.get('left_company_at'):
            continue
        d = by.setdefault(c['company_key'], [0, 0, 0])
        d[0] += 1
        t = c.get('title') or ''
        d[1] += bool(rec.search(t))
        d[2] += bool(dev.search(t))
    jobs = [j for j in jobs if j['id'] not in applied]
    cos = {}
    for j in jobs:
        k = key(j['company'])
        k = al.get(k, k)
        cos.setdefault(k, []).append(j)
    withc = [k for k in cos if k in by]
    withr = [k for k in cos if k in by and by[k][1]]
    withd = [k for k in cos if k in by and by[k][2]]
    summary(f'open target jobs not applied, last 30 days: {len(jobs)} in {len(cos)} companies')
    summary(f'companies with any contact: {len(withc)} ({sum(len(cos[k]) for k in withc)} jobs)')
    summary(f'  with a recruiter/HR contact: {len(withr)} ({sum(len(cos[k]) for k in withr)} jobs)')
    summary(f'  with a dev-manager contact: {len(withd)} ({sum(len(cos[k]) for k in withd)} jobs)')
    summary(f'companies with NO contact: {len(cos) - len(withc)} ({sum(len(v) for k, v in cos.items() if k not in by)} jobs)')
    for k in sorted(withc, key=lambda k: -len(cos[k]))[:25]:
        summary(f'  {k}: jobs {len(cos[k])}, contacts {by[k][0]}, recruiters {by[k][1]}, dev {by[k][2]} | {cos[k][0]["title"][:50]}')


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'cover':
        return cover()
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    rows = sql(
        "with rc as (select company_key, mode() within group (order by company) name, count(*) people "
        "from contacts where company_key is not null and company_key<>'' and "
        "title ~* '(recruit|talent|hr |human resources|acquisition|גיוס|משאבי אנוש)' group by 1) "
        "select rc.company_key, rc.name, rc.people, c.website, c.comeet_id, c.lever_id, c.careers_url "
        f"from rc left join companies c on c.company_key=rc.company_key order by md5(rc.company_key) limit {n}")
    summary(f'sample {len(rows)} companies')
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        res = list(ex.map(probe, rows))
    hit = [r for r in res if r['platform']]
    tgt = [r for r in hit if r['target']]
    known = [r for r in res if not r['platform'] and (r.get('comeet_id') or r.get('lever_id') or r.get('careers_url'))]
    summary(f"found a public board with Israel postings: {len(hit)}/{len(res)}")
    summary(f"  of them with a target-role posting: {len(tgt)}; target postings total {sum(len(r['target']) for r in tgt)}")
    summary(f"no board found but a careers url or comeet/lever id is known: {len(known)}")
    summary(f"no source at all: {len(res) - len(hit) - len(known)}")
    by = {}
    for r in hit:
        by[r['platform']] = by.get(r['platform'], 0) + 1
    summary('by platform: ' + json.dumps(by))
    for r in tgt:
        summary(f"  {r['name']} [{r['platform']}/{r['token']}] il={r['il']} target={r['target'][:3]}")


if __name__ == '__main__':
    main()
