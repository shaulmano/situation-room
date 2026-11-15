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
from datetime import datetime, timezone
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_sync import sql, q


# שבוע. שאול, 15.11.2026: "אני רוצה תגובות רק מהשבוע האחרון. מידע ישן
# לא מעניין."
#
# **וזה מתנגש עם הסיבה שהקובץ הזה נכתב**, שמתועדת למעלה: לי צמח ענתה
# ב-12.10 ושאול ראה את זה 33 יום אחרי. חלון של שבוע היה מפיל אותה.
#
# מה שהשתנה בינתיים: אותה סריקה אחורה כבר רצה והבאקלוג כולו רשום, והסוכן
# רץ ארבע פעמים ביום. תגובה חדשה נתפסת תוך שעות, ולכן תגובה בת יותר
# משבוע שמגיעה עכשיו היא כמעט תמיד שיחה ישנה שהסוכן גלל אליה, ולא תגובה
# שפוספסה. **אם אי פעם תיפסק הריצה לשבועיים, הכלל הזה יסתיר בדיוק את מה
# שהצטבר**, ואז צריך להרחיב אותו ידנית לפני שמפעילים מחדש.
MAX_REPLY_AGE_DAYS = 7


def norm(s):
    return ' '.join((s or '').split()).lower()


# כתובת מייל שנכתבה בתוך תגובה.
#
# 14.11.2026. בר זרקו מ-Similarweb ענתה "תשלח לי בפרטי" ונתנה את
# bar.zarko@similarweb.com. שאול: "זה בדיוק מה שרצינו כל הזמן, מייל אמיתי
# של מגייסת", ומיד אחרי זה: "למרות שיש לי כפתור למילוי מייל גם אני שכחתי".
#
# **זאת הנקודה.** יש כפתור ידני והוא לא נלחץ, כי הוא תלוי בכך שהוא יזכור
# בדיוק ברגע שהוא קורא הודעה. 60 מתוך 2,657 אנשי הקשר נושאים כתובת, והמסך
# "במייל" מוגבל להם בלבד. כתובת שמישהו טרח לכתוב לך בעצמו היא הכתובת
# האיכותית ביותר שיש, והיא עברה כאן ונזרקה.
#
# זאת הפעם הרביעית שאותו דפוס חוזר: התיאור עד 2.11, found_for עד 10.11,
# המפרסם עד 13.11, וזה.

_EMAIL = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
_JUNK = ('linkedin.com', 'example.com', 'sentry.io')


def _tokens(s):
    return {t for t in re.split(r'[^A-Za-z0-9]+', (s or '').lower()) if len(t) > 2}


def pick_email(text, full_name, company):
    """הכתובת היחידה שבטוח שייכת לאיש הקשר הזה, או None.

    **לא כל כתובת בהודעה היא הכתובת של מי שכתב אותה.** אדם יכול להפנות
    לעמית ("תשלח ליוסי, yossi@"), וכתיבת הכתובת הזאת על השורה שלו היא
    נתון שגוי בלי שום סימן. שאול ביקש במפורש רק דברים בטוחים.

    לכן נדרשת התאמה: או שהדומיין הוא החברה שלו, או ששם המשתמש מכיל חלק
    מהשם שלו. bar.zarko@similarweb.com עונה על שניהם. מה שלא עונה מדווח
    בפלט ולא נכתב, כדי שאפשר יהיה לראות מה נפסל.
    """
    want = _tokens(full_name) | _tokens(company)
    if not want:
        return None, []
    rejected = []
    for addr in _EMAIL.findall(text or ''):
        addr = addr.strip('.,;:)>]').lower()
        local, _, domain = addr.partition('@')
        if any(domain.endswith(j) for j in _JUNK) or 'noreply' in local or 'no-reply' in local:
            continue
        if _tokens(local) & want or _tokens(domain.rsplit('.', 1)[0]) & want:
            return addr, rejected
        rejected.append(addr)
    return None, rejected


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()

    # 14.11.2026: "force" מאפס את סימון הפוש על התגובות הפתוחות, כדי
    # שאפשר יהיה לשלוח שוב ולבדוק את ההתראה עצמה. לא נוגע בתגובות
    # ובסטטוס שלהן, רק בשאלה אם כבר צלצלנו עליהן.
    if raw.strip() == 'force':
        sql("update contacts set reply_pushed_at = null "
            "where replied_at is not null and reply_done_at is null")
        print('push marks cleared, the next send will announce them again')
        return

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

    known = sql("select id, full_name, company, email from contacts "
                "where coalesce(full_name,'') <> ''")
    by_name = {}
    for c in known:
        by_name.setdefault(norm(c['full_name']), c)

    hit = miss = mails = 0
    for r in rows:
        name = (r.get('name') or '').strip()
        who = by_name.get(norm(name))
        cid = who['id'] if who else None
        if not cid:
            # לא להמציא שורה. מי שלא באנשי הקשר הוא לא מכר של שאול, וייתכן
            # שזה מגייס שפנה אליו מיוזמתו. הוא מדווח כאן ונעצר.
            print('  not in contacts, skipped: %s' % name[:50])
            miss += 1
            continue
        # תגובה חדשה מחזירה שיחה שנסגרה.
        #
        # 14.11.2026, שאול: "ברגע שסימנתי שיחה כטופלה אתה לא תדע עליה ולא
        # תמשיך להציף הודעות... הסימון הזה הוא דטרמיניסטי. צריך לחשוב על
        # להחזיר אותו לחיים במידה ושיחה ממשיכה אחרי סימון טיפלתי."
        #
        # הוא צדק, וזה קרה לו באותו יום: הוא סימן את עמרי ינאי כטופל, ועמרי
        # ענה שוב אחרי. הגרסה הקודמת גם דילגה על שורה שסומנה כטופלה
        # (`and reply_done_at is null`), כלומר התגובה החדשה הייתה נעלמת
        # לגמרי, וגם השאירה את `replied_at` הישן בגלל coalesce, כלומר
        # "ממתין 3 ימים" במקום "ענה עכשיו".
        #
        # **"טיפלתי" סוגר תגובה, לא שיחה.** תגובה חדשה יותר, או טקסט אחר,
        # מאפסת גם את reply_done_at וגם את reply_pushed_at, ולכן השורה
        # חוזרת לבאנר ויוצא עליה פוש.
        #
        # התנאי הוא מה ששומר על זה: קריאה חוזרת של אותה תגובה בדיוק לא
        # מחזירה אותה לחיים, אחרת כל ריצה של הסוכן הייתה פותחת מחדש כל מה
        # שנסגר.
        txt = (r.get('text') or '')[:400] or None

        # **השעה שהסוכן קורא מלינקדאין אינה נושאת אזור זמן.**
        #
        # 14.11.2026: עמרי ענה ב-16:58 שעון ישראל, ונרשם 17:58+00, כלומר
        # 19:58 מקומי, שעה וחצי בעתיד. לינקדאין מציג שעה מקומית בלי סימן,
        # והסוכן מרכיב ממנה ISO.
        #
        # למה זה לא רק מספר לא נעים: `replied_at` בעתיד הופך את התנאי
        # `replied_at < <השעה שנתנו>` לאמת **בכל ריצה**, כי השמירה מקצצת
        # להווה והקריאה הבאה מביאה שוב את אותה שעה עתידית. כל ריצה הייתה
        # פותחת מחדש את מה ששאול סגר ומוציאה עליו פוש. בדיוק מה שהתנאי
        # הזה נועד למנוע.
        #
        # לכן הקיצוץ נעשה פעם אחת, באותו ביטוי, גם בשמירה וגם בהשוואה.
        at = r.get('at') or None

        # **תגובה ישנה לא נכנסת.**
        #
        # 15.11.2026, שאול: "למה אני מקבל תגובות מלפני 70 יום?" ואחריו
        # "אני רוצה תגובות רק מהשבוע האחרון. מידע ישן לא מעניין."
        #
        # נמדד: באותו יום ב-16:30 נכנסו ארבע תגובות מ-24.08 עד 01.09, בנות
        # כ-77 יום, וכולן ברכות על התפקיד החדש ולא תגובות למשרה. הסוכן ירד
        # עמוק יותר ברשימת השיחות, וכל שיחה ישנה שבה הצד השני כתב אחרון
        # נראית לו כמו תגובה שממתינה.
        #
        # **הגבול כאן ולא במסך**, כי מסך לבדו משאיר את הכתיבה ואת הפוש.
        # תגובה בלי תאריך כן נכנסת: היא כנראה חדשה, והסוכן פשוט לא הצליח
        # לקרוא שעה.
        if at:
            try:
                when = datetime.fromisoformat(str(at).replace('Z', '+00:00'))
                if when.tzinfo is None:
                    when = when.replace(tzinfo=timezone.utc)
                old_days = (datetime.now(timezone.utc) - when).days
                if old_days > MAX_REPLY_AGE_DAYS:
                    print('  too old, skipped: %s, %d days' % (name[:40], old_days))
                    miss += 1
                    continue
            except Exception as e:
                print('  unreadable date, kept: %s, %s' % (name[:40], e))

        at_sql = 'least(%s::timestamptz, now())' % q(at) if at else 'null::timestamptz'

        # **הכל ב-format ואף %s בשאילתה הזאת.**
        #
        # 14.11.2026, אותו יום: הגרסה הראשונה של הקיצוץ שירשרה את at_sql
        # עם + לתוך מחרוזת שהסתיימה ב-% (...), ובפייתון % קודם ל-+, ולכן
        # הפורמט הוחל רק על המחרוזת האחרונה בשרשרת ולא על כולה. התוצאה:
        # TypeError בכל קריאה, הוורקפלו נפל אחרי "replies to record: 2",
        # ו-notify_push לא רץ בכלל. ערבוב של + ושל % באותו ביטוי הוא
        # מלכודת, ולכן אין כאן % בכלל.
        # 15.11.2026, שאול: "אלו שענו לי וכתבת לי אני רוצה שתנסח לי גם
        # תשובות ומציאה של מה שמבקשים". הנוסח נכתב על ידי מי שקרא את
        # השרשור, כולל הקישור או הפרט שביקשו, והוא נשמר כאן ומוצג בבאנר
        # עם כפתור העתקה. **לעולם לא נשלח לבד.**
        #
        # הוא נכתב באותה שורת UPDATE ולא בנפרד, בכוונה: טיוטה חייבת
        # להתחלף יחד עם התגובה שהיא עונה לה. נוסח שנשאר מהתגובה הקודמת
        # הוא תשובה נכונה לשאלה הלא נכונה, וזה גרוע מריק.
        draft = (r.get('draft') or '')[:1200] or None

        changed = sql(
            ("update contacts set "
             "replied_at = coalesce({at}, replied_at, now()), "
             "reply_text = {txt}, reply_url = {url}, reply_draft = {draft}, "
             "reply_done_at = null, reply_pushed_at = null "
             "where id = {cid} and ("
             "  replied_at is null"
             "  or ({at} is not null and replied_at < {at})"
             "  or coalesce(reply_text,'') <> coalesce({txt},'')"
             ") returning id").format(
                at=at_sql, txt=q(txt), draft=q(draft),
                url=q(r.get('url') or None), cid=q(cid))
        )

        # **והשלמת נוסח לתגובה שכבר רשומה, בלי לפתוח אותה מחדש.**
        #
        # בשורה אחת זה היה מסוכן: כל תנאי שמוסיפים ל-UPDATE שלמעלה גורר
        # איתו גם `reply_done_at = null` ו-`reply_pushed_at = null`,
        # כלומר השלמת נוסח לתגובה ששאול כבר טיפל בה הייתה מחזירה אותה
        # לבאנר ומוציאה עליה פוש שני. לכן זאת פקודה נפרדת שנוגעת בנוסח
        # בלבד, ורק כשאין נוסח.
        if not changed and draft:
            filled = sql(
                ("update contacts set reply_draft = {draft} "
                 "where id = {cid} and coalesce(reply_draft,'') = '' "
                 "returning id").format(draft=q(draft), cid=q(cid))
            )
            if filled:
                print('  draft added: %s' % name[:46])
        if changed:
            hit += 1
            print('  %s' % name[:50])
        else:
            print('  unchanged, left as is: %s' % name[:50])

        # הכתובת נכתבת גם כשהתגובה עצמה לא השתנתה: ייתכן שהשורה כבר
        # נרשמה בריצה קודמת ורק עכשיו נוספה היכולת לקרוא ממנה כתובת.
        # coalesce ולא השמה: כתובת שכבר קיימת לא נדרסת לעולם.
        addr, rejected = pick_email(txt, who.get('full_name'), who.get('company'))
        if addr and not (who.get('email') or '').strip():
            got = sql("update contacts set email = %s "
                      "where id = %s and coalesce(email,'') = '' returning id"
                      % (q(addr), q(cid)))
            if got:
                mails += 1
                who['email'] = addr
                print('    email from the message: %s' % addr)
        elif addr:
            print('    already has an email, kept: %s' % who.get('email'))
        for bad in rejected:
            # לא נזרק בשקט. כתובת שנפסלה היא או עמית שהוא הפנה אליו, או
            # התאמה שהבדיקה פספסה, ואת ההבדל רואים רק כשהיא מודפסת.
            print('    address in the message, not matched to this contact: %s' % bad)

    print('recorded %d, unchanged or skipped %d' % (hit, len(rows) - hit))
    if mails:
        print('email addresses learned from messages: %d' % mails)
    if miss:
        print('(%d were not in contacts)' % miss)


if __name__ == '__main__':
    main()
