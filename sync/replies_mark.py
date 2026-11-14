"""
Record LinkedIn replies that are waiting for an answer.

14.11.2026. Shaul found that Lee Zemach had answered him on 12 October and he
only noticed 33 days later, while sending her another message. In his words:
"I wrote to someone I saw had replied to me ages ago, and I just never
answered". A reply that sits unanswered is the most expensive loss in this
system: 41 messages produced 3 replies, so one of them is worth roughly
fourteen fresh approaches, and silence reads to the other side as disinterest.

The agent that reads his inbox runs in a browser on his own machine and cannot
reach Supabase, so it hands the rows here and this writes them.

Matching is by name. The contacts table holds the same names LinkedIn shows,
because both come from his own connections export. A reply from someone who is
not in contacts is reported and skipped rather than invented into a row.

Input: JSON on argv[1] or stdin, a list of
    {"name": "...", "text": "...", "url": "...", "at": "2026-11-14T15:55:00Z"}

Run: python sync/replies_mark.py '[{"name": "...", ...}]'
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q


def norm(s):
    return ' '.join((s or '').split()).lower()


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    try:
        rows = json.loads(raw or '[]')
    except ValueError as e:
        raise SystemExit('bad JSON: %s' % e)
    if not isinstance(rows, list):
        raise SystemExit('expected a list')

    print('replies to record: %d' % len(rows))
    if not rows:
        print('nothing to do')
        return

    known = sql("select id, full_name from contacts where coalesce(full_name,'') <> ''")
    by_name = {}
    for c in known:
        by_name.setdefault(norm(c['full_name']), c['id'])

    hit = miss = 0
    for r in rows:
        name = (r.get('name') or '').strip()
        cid = by_name.get(norm(name))
        if not cid:
            # לא להמציא שורה. מי שלא באנשי הקשר הוא לא מכר של שאול, וייתכן
            # שזה מגייס שפנה אליו מיוזמתו. הוא מדווח כאן ונעצר.
            print('  not in contacts, skipped: %s' % name[:50])
            miss += 1
            continue
        # coalesce על replied_at: הזמן של התגובה הראשונה שלא נענתה הוא מה
        # שמודד כמה זמן היא מחכה, ולכן ריצה חוזרת לא דוחפת אותו קדימה.
        # הטקסט והקישור כן מתעדכנים: הם מתארים את מה שעומד עכשיו.
        sql(
            "update contacts set "
            "replied_at = coalesce(replied_at, %s), "
            "reply_text = %s, reply_url = %s "
            "where id = %s and reply_done_at is null"
            % (q(r.get('at') or None), q((r.get('text') or '')[:400] or None),
               q(r.get('url') or None), q(cid))
        )
        hit += 1
        print('  %s' % name[:50])

    print('recorded %d, skipped %d' % (hit, miss))


if __name__ == '__main__':
    main()
