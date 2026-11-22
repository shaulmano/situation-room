"""תור שליחת הודעות לינקדאין (li_outbox). הסוכן שולח מהדפדפן של שאול.

    python sync/outbox.py list [N]      מדפיס עד N שורות ממתינות ומסמן אותן sending
    python sync/outbox.py mark ID STATUS [note]
                                        STATUS: sent או failed

שורה שנכשלה מחזירה את האדם לתור הפנייה הרחבה (wide_sent_at מתנקה), כדי
שהחלטה שלא הושלמה לא תיעלם בשקט. שורה שנשלחה מסמנת פנייה לאיש הקשר.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q  # noqa: E402

DAILY_LIMIT = 25


def listing(n):
    done = sql("select count(*) n from li_outbox where status='sent' and "
               "sent_at::date = (now() at time zone 'Asia/Jerusalem')::date")
    sent_today = int(done[0]["n"]) if done else 0
    room = max(0, DAILY_LIMIT - sent_today)
    take = min(n, room)
    print("SENT_TODAY: %d, ROOM: %d" % (sent_today, room))
    if take <= 0:
        print("PENDING: 0")
        return
    rows = sql(
        "update li_outbox set status='sending' where id in ("
        "select id from li_outbox where status='queued' order by queued_at limit %d) "
        "returning id, profile_url, to_name, message, cv_file, kind;" % take)
    print("PENDING: %d" % len(rows))
    for r in rows:
        print("ITEM " + json.dumps(r, ensure_ascii=False))


def mark(item_id, status, note=""):
    if status not in ("sent", "failed"):
        raise SystemExit("status must be sent or failed")
    sql("update li_outbox set status=%s, error=%s, sent_at=%s where id=%s;"
        % (q(status), q(note[:300]) if status == "failed" else "null",
           "now()" if status == "sent" else "null", q(item_id)))
    if status == "sent":
        sql("update contacts set contacted_at = coalesce(contacted_at, now()) "
            "where id = (select contact_id from li_outbox where id=%s);" % q(item_id))
    else:
        sql("update contacts set wide_sent_at = null where id = "
            "(select contact_id from li_outbox where id=%s and kind='wide');" % q(item_id))
    print("outbox %s -> %s" % (item_id, status))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "list"
    if mode == "list":
        listing(int(sys.argv[2]) if len(sys.argv) > 2 else 5)
    elif mode == "mark":
        mark(sys.argv[2], sys.argv[3], " ".join(sys.argv[4:]))
