import Link from 'next/link';
import { serverClient } from '@/lib/server';
import ReachList, { type ReachRow } from '@/components/ReachList';
import {
  DAILY_TARGET, WIDE_CV_FILE, bucketOf, eligible, israelDayStart,
  sortQueue, wideMessage, type ReachContact,
} from '@/lib/wideReach';

export const dynamic = 'force-dynamic';

/**
 * פנייה רחבה: מסך ייעודי, מטרה אחת.
 *
 * 15.11.2026. שאול ביקש טאב נפרד ולא עוד לשונית בתוך מכרים: "כל טאב
 * הוא יעודי למטרה ספציפית". הטאב "בלינקדאין" שבמכרים נשאר כמו שהוא,
 * והוא עונה על שאלה אחרת: פנייה על משרה פתוחה קונקרטית.
 *
 * **ואדם לא יופיע בשניהם באותו יום.** מי שפנית אליו על משרה ב-60
 * הימים האחרונים אינו זכאי כאן, ראה `eligible`.
 */
export default async function Reach() {
  const sb = serverClient();

  const [{ data: all, error }, { count: sentToday }] = await Promise.all([
    sb.from('contacts')
      .select('id, full_name, title, company, linkedin_url, contacted_at, '
        + 'wide_sent_at, wide_skipped_at, left_company_at')
      .is('wide_sent_at', null)
      .is('wide_skipped_at', null)
      .not('linkedin_url', 'is', null)
      .limit(4000),
    sb.from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('wide_sent_at', israelDayStart()),
  ]);

  if (error) {
    return (
      <main>
        <div className="head">
          <h1>פנייה רחבה</h1>
          <Link className="more" href="/">← חדר המצב</Link>
        </div>
        <div className="alert">שגיאה בשליפה: {error.message}</div>
      </main>
    );
  }

  const done = sentToday ?? 0;
  const left = Math.max(0, DAILY_TARGET - done);

  const list = (all ?? []) as unknown as ReachContact[];
  const queue = sortQueue(list.filter((c) => eligible(c)));
  const rows: ReachRow[] = queue.slice(0, left).map((c) => ({
    id: c.id,
    name: c.full_name ?? '',
    title: c.title ?? null,
    company: c.company ?? null,
    url: c.linkedin_url ?? null,
    bucket: bucketOf(c.title)!,
    message: wideMessage(c),
  }));

  const pool = queue.length;

  return (
    <main>
      <div className="head">
        <h1>פנייה רחבה</h1>
        <Link className="more" href="/">← חדר המצב</Link>
      </div>

      <p className="sub">
        פנייה כללית לאנשי קשר שאתה מחובר אליהם, בלי קשר למשרה פתוחה.
        {' '}{DAILY_TARGET} ביום, ובנוסף לכל השאר. נשארו <b>{pool}</b> במאגר.
      </p>

      <ReachList
        rows={rows}
        sample={wideMessage({ full_name: rows[0]?.name ?? 'Mor Barki' })}
        cvFile={WIDE_CV_FILE}
        target={DAILY_TARGET}
        sentToday={done}
      />
    </main>
  );
}
