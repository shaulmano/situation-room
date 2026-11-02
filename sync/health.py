"""מתריע כשלא נכנסות משרות, להבדיל מכשתהליך נופל.

שומר הסף שבריפו של הבוט בודק דבר אחד: האם ה-workflow בענן רץ בהצלחה.
זה עונה על "האם המכונה נדלקה", ולא על "האם יצא ממנה משהו", ובדיוק שם
נפלו כל התקלות של 2026: מקור שהוצא מהרשימה, משימה מתוזמנת שכובתה,
וסקרייפר שהסלקטור שלו זז. בכל אחד מהם הריצה בענן נשארה ירוקה ושומר
הסף שתק, ושאול גילה שבועות אחר כך לפי היעדר משרות.

הקובץ הזה בודק את התפוקה במסד, ושולח פוש כשהיא נעלמת.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql                      # noqa: E402
from notify_push import send, vapid             # noqa: E402

# מקור שהביא פחות מזה לפני כן הוא מקור שגם ככה בקושי מביא, והשתיקה שלו
# אינה ראיה לתקלה.
MIN_HISTORY = 5

ISRAEL = timezone(timedelta(hours=2))


def quiet_pipeline():
    """אף משרה על המטרה ביממה. לא נבדק בשישי ובשבת, שם שקט הוא נורמלי."""
    day = datetime.now(ISRAEL).weekday()        # שני=0 ... שישי=4, שבת=5
    if day in (4, 5):
        print('weekend: skipping the 24h check')
        return None
    n = sql("select count(*) n from jobs where on_target "
            "and first_seen >= now() - interval '24 hours'")[0]['n']
    print(f'on-target jobs in the last 24h: {n}')
    return None if int(n) else 'לא נכנסה אף משרה ב-24 השעות האחרונות'


def sources_gone_quiet():
    """מקור שהביא בעבר ולא מביא בשבוע האחרון. זה הכישלון שחזר כל חודש."""
    rows = sql(
        "select source, "
        "count(*) filter (where first_seen >= now() - interval '7 days') recent, "
        "count(*) filter (where first_seen >= now() - interval '37 days' "
        "                   and first_seen <  now() - interval '7 days') before "
        "from jobs where on_target group by source"
    )
    dead = [r['source'] for r in rows
            if int(r['before']) >= MIN_HISTORY and int(r['recent']) == 0]
    for r in sorted(rows, key=lambda r: -int(r['recent'])):
        print(f"  {r['source']:<14} week {r['recent']:>4}  prev-30d {r['before']:>5}")
    if not dead:
        return None
    return 'הפסיקו להביא: ' + ', '.join(sorted(dead))


def push(title, body):
    subs = sql('select endpoint, p256dh, auth from push_subscriptions '
               'where failures < 5')
    if not subs:
        print('no push subscriptions, nothing to notify')
        return
    pub, priv = vapid()
    # tag קבוע: התראה חדשה מחליפה את הקודמת על המכשיר במקום להיערם.
    payload = {'title': title, 'body': body, 'url': '/sources', 'tag': 'health'}
    for sub in subs:
        print(f"  {sub['endpoint'][:48]}… -> {send(sub, payload, pub, priv)}")


def jobs_without_matches():
    """משרה שנכנסה אבל לא נוקדה. בלתי נראית על המסך, ובלי שום שגיאה.

    2.11.2026: גרסת קורות חיים חדשה הפילה את score.py, והמשרות של אותו יום
    נכנסו ל-jobs בלי שורה ב-matches. כל המסכים מצרפים jobs ל-matches, ולכן
    הלוח נראה ריק בזמן שהמשרות היו שם. שתי הבדיקות הקיימות לא תפסו את זה:
    המשרות כן נכנסו, והמקורות כן הביאו.
    """
    n = sql(
        "select count(*) n from jobs j "
        "where j.first_seen >= now() - interval '24 hours' "
        "  and not exists (select 1 from matches m where m.job_id = j.id)"
    )[0]['n']
    print(f'jobs from the last 24h with no match row: {n}')
    if int(n) == 0:
        return None
    return f'{n} משרות נכנסו ולא נוקדו, ולכן הן לא מופיעות על המסך'


def main():
    # הסנכרון רץ שלוש פעמים ביום. מתריעים בבוקר ובערב בלבד, כדי שהתראה
    # בזמן תקלה ממושכת תגיע פעמיים ביום ולא שלוש. הרצה ידנית תמיד בודקת.
    manual = os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
    hour = datetime.now(ISRAEL).hour
    if not manual and hour not in (4, 20):
        print(f'{hour:02d}:00 Israel: not an alerting slot, checking only')

    problems = [p for p in (quiet_pipeline(), sources_gone_quiet(),
                            jobs_without_matches()) if p]

    if not problems:
        print('healthy')
        return

    print('PROBLEM: ' + ' | '.join(problems))
    if manual or hour in (4, 20):
        push('חדר המצב: הסריקה שקטה', ' · '.join(problems))


if __name__ == '__main__':
    main()
