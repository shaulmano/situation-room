import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { DAILY_TARGET, israelDayStart } from '@/lib/wideReach';
import { loadJobConnect } from '@/lib/jobConnect';
import { warmTodayCount } from '@/lib/warmCount';
import { loadClients } from '@/lib/clients';

export const dynamic = 'force-dynamic';

/**
 * המטלות להיום, במקום אחד ולפי סדר עדיפות.
 *
 * 26.11.2026. שאול: "בכל יום בבוקר יהיו המטלות להיום". כל התורות כבר קיימים
 * ומוצגים כאריחים בדף הבית, מפוזרים בין שמונה אריחים. המסך הזה לא מחשב שום
 * דבר חדש: הוא קורא **באותן פונקציות ובאותם תנאים** ומסדר אותם לפי כמה כל
 * אחד דחוף, כך שהמספרים זהים לאלה שבדף הבית.
 *
 * הסדר: תשובה שממתינה שווה בערך ארבע עשרה פניות חדשות (14.11), ולכן היא
 * ראשונה. אחריה מי שאישר חברות ומחכה לקורות חיים, אחר כך הגשות של היום
 * שיש בהן מכר, אחר כך בקשות חברות, ובסוף הפנייה הרחבה.
 *
 * שום דבר כאן לא נשמר. מטלה נעלמת כשהתור שלה מתרוקן, כלומר כשבוצעה.
 */
type Task = { href: string; title: string; sub: string; n: number | null };

export default async function Today() {
  const sb = serverClient();
  const [cl, rep, acc, warm, jc, wide] = await Promise.all([
    loadClients(sb),
    sb.from('contacts').select('id', { count: 'exact', head: true })
      .not('replied_at', 'is', null).is('reply_done_at', null),
    sb.from('contacts').select('id', { count: 'exact', head: true })
      .not('invite_accepted_at', 'is', null).is('contacted_at', null).is('skipped_at', null),
    warmTodayCount(sb),
    loadJobConnect(sb),
    sb.from('contacts').select('id', { count: 'exact', head: true })
      .or('wide_sent_at.gte.' + israelDayStart() + ',wide_skipped_at.gte.' + israelDayStart()),
  ]);
  const replies = rep.error ? null : (rep.count ?? 0);
  const accepted = acc.error ? null : (acc.count ?? 0);
  // warmTodayCount כולל גם את התגובות, ולכן מפרידים כדי לא לספור פעמיים.
  const warmApps = warm === null || replies === null ? null : Math.max(0, warm - replies);
  const connectLeft = Math.min(jc.left, jc.rows.length);
  const reachLeft = Math.max(0, DAILY_TARGET - (wide.count ?? 0));

  // אותו חישוב בדיוק כמו האריח "מחכים לפעולה שלך" במסך הלקוחות.
  const waitIn = (g: string) => cl.clients.filter((c) => c.group === g && !!c.next && !c.next.startsWith('מחכה')).length;
  const clientsErr = !!cl.error;
  const tasks: Task[] = [
    { href: '/clients?waiting=1&group=recruiter', title: 'לקוחות: מגייסות ו-HR שמחכים לך', sub: 'הצעד הבא ברשימת הלקוחות', n: clientsErr ? null : waitIn('recruiter') },
    { href: '/clients?waiting=1&group=dev', title: 'לקוחות: מנהלי פיתוח שמחכים לך', sub: 'הצעד הבא ברשימת הלקוחות', n: clientsErr ? null : waitIn('dev') },
    { href: '/warm', title: 'ענו לך', sub: 'תשובות שממתינות. הנוסח מוכן להעתקה', n: replies },
    { href: '/warm?tab=invites', title: 'אישרו חברות', sub: 'מחכים להודעה עם קורות החיים', n: accepted },
    { href: '/warm?tab=today', title: 'הגשות של היום עם מכר', sub: 'פנייה דרך מי שאתה מכיר בחברה', n: warmApps },
    { href: '/connect', title: 'בקשות חברות לפי משרה', sub: 'חברות עם משרה מתאימה ובלי איש קשר', n: connectLeft },
    { href: '/reach', title: 'פנייה רחבה', sub: 'מכסה יומית של ' + DAILY_TARGET, n: reachLeft },
  ];
  const open = tasks.filter((t) => (t.n ?? 0) > 0);
  const total = open.reduce((s, t) => s + (t.n ?? 0), 0);
  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' });

  return (
    <main>
      <div className="head">
        <h1>מטלות להיום</h1>
        <Link className="more" href="/">← חדר המצב</Link>
      </div>
      <p className="sub">
        {today}. {total > 0 ? <>נשארו <b>{total}</b> פעולות ב-{open.length} תורות.</> : 'אין כרגע מטלות פתוחות.'}
        {' '}המספרים זהים לאריחים בדף הבית.
      </p>
      {tasks.map((t) => (
        <Link key={t.href} className="radar-tile" href={t.href} prefetch style={(t.n ?? 0) === 0 ? { opacity: 0.55 } : undefined}>
          <span className="rt-t">
            <b>{t.title} ←</b>
            <span>{(t.n ?? 0) === 0 ? 'אין כרגע מה לעשות כאן' : t.sub}</span>
          </span>
          <span className="rt-n">{t.n ?? '←'}</span>
        </Link>
      ))}
    </main>
  );
}
