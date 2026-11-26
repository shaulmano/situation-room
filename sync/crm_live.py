"""בדיקת חיוּת של המשרות הפתוחות שמסך הלקוחות מציג. קריאה בלבד.

26.11.2026. שאול ביקש לוודא שהמידע אמיתי. לוקח את המשרות הפתוחות והמתאימות
מה-30 ימים האחרונים (אותו תנאי של loadClients), ובודק כל כתובת:
לוחות רגילים עם posting_is_live, ולינקדאין לפי הטקסט שהעמוד מציג למודעה סגורה.

    python sync/crm_live.py [limit]
"""
import concurrent.futures
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cv_requests import sql, summary
from seo_jobs import posting_is_live

CLOSED = re.compile(r'no longer accepting applications|job is no longer available|לא מקבלת? מועמדויות', re.I)


def li_check(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read(400000).decode('utf-8', 'replace')
        return (not CLOSED.search(html)), 'closed text' if CLOSED.search(html) else 'ok'
    except Exception as e:
        return True, 'unknown: %s' % str(e)[:40]


def check(row):
    url = row['url']
    if 'linkedin.com/jobs/view' in url:
        ok, why = li_check(url)
        return row, ok, why, 'li'
    ok, why = posting_is_live(url)
    return row, ok, why, 'board'


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 150
    rows = sql(
        "select distinct on (j.url) j.id, left(j.title,40) title, left(j.company,24) company, j.url "
        "from jobs j join matches m on m.job_id=j.id "
        "where j.on_target and j.dismissed_at is null and j.closed_at is null "
        "and j.first_seen >= now() - interval '30 days' and j.url is not null "
        f"order by j.url, j.id limit 3000")
    li = [r for r in rows if 'linkedin.com' in r['url']]
    other = [r for r in rows if 'linkedin.com' not in r['url']]
    summary(f'open target jobs: {len(rows)} (linkedin {len(li)}, other {len(other)})')
    pick = other[:n] + li[:60]
    dead = []
    stats = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        for row, ok, why, kind in ex.map(check, pick):
            k = (kind, 'live' if ok else 'dead')
            stats[k] = stats.get(k, 0) + 1
            if not ok:
                dead.append((row, why))
    summary('checked: ' + ', '.join(f'{k[0]} {k[1]}={v}' for k, v in sorted(stats.items())))
    for row, why in dead[:40]:
        summary(f"  DEAD {row['company']} | {row['title']} | {why} | {row['url'][:90]}")


if __name__ == '__main__':
    main()
