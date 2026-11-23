"""קורא את הלוחות שנמצאו ב-company_ats ומדפיס משרות על המטרה בישראל כ-JSON.

23.11.2026. מקביל ל-`boards.py read`, רק שהלוחות נקראים דרך ה-API של כל
פלטפורמה. stdout הוא JSON נקי לצינור אל `seo_jobs.py`, והאבחון ל-stderr.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cv_requests import sql           # noqa: E402
from boards import role_of, in_israel  # noqa: E402
from ats_discover import get          # noqa: E402


def say(*a):
    print(*a, file=sys.stderr)


def rows_for(platform, tok):
    if platform == 'greenhouse':
        for j in get(f'https://boards-api.greenhouse.io/v1/boards/{tok}/jobs').get('jobs') or []:
            yield j.get('title'), j.get('absolute_url'), (j.get('location') or {}).get('name')
    elif platform == 'lever':
        for j in get(f'https://api.lever.co/v0/postings/{tok}?mode=json'):
            yield j.get('text'), j.get('hostedUrl'), (j.get('categories') or {}).get('location')
    elif platform == 'ashby':
        for j in get(f'https://api.ashbyhq.com/posting-api/job-board/{tok}').get('jobs') or []:
            yield j.get('title'), j.get('jobUrl'), j.get('location')
    elif platform == 'smartrecruiters':
        for j in get(f'https://api.smartrecruiters.com/v1/companies/{tok}/postings?limit=100').get('content') or []:
            loc = j.get('location') or {}
            yield (j.get('name'), f"https://jobs.smartrecruiters.com/{tok}/{j.get('id')}",
                   f"{loc.get('city', '')} {loc.get('country', '')}")


def main():
    boards = sql("select a.platform, a.token, c.name from company_ats a join companies c on c.id = a.company_id "
                 "where a.il_postings > 0") or []
    say(f'boards to read: {len(boards)}')
    found = []
    for b in boards:
        try:
            rows = list(rows_for(b['platform'], b['token']))
        except Exception as e:
            say(f"  {b['name'][:28]:<28} failed: {e}")
            continue
        kept = 0
        for title, url, loc in rows:
            role = role_of(title or '')
            if not role or not in_israel(loc or '') or not (url or '').startswith('http'):
                continue
            found.append({'title': title, 'company': b['name'], 'url': url, 'location': loc,
                          'source': b['platform'].capitalize(), 'found_for': role})
            kept += 1
        say(f"  {b['name'][:28]:<28} {len(rows):3d} open, {kept} on target")
    say(f'on target across all boards: {len(found)}')
    print(json.dumps(found, ensure_ascii=False))


if __name__ == '__main__':
    main()
