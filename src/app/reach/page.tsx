import Link from 'next/link';
import { serverClient } from '@/lib/server';
import ReachList, { type ReachRow } from '@/components/ReachList';
import {
  DAILY_TARGET, RECRUITERS_ONLY, WIDE_CV_FILE, bucketOf, displayName, eligible, israelDayStart,
  looksLikeAgency, sortQueue, wideMessage, type ReachContact,
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

  // **המכסה היומית נספרת על החלטות, ולא על שליחות.**
  //
  // 18.11.2026. שאול: **"אני שולח הודעות בפניה רחבה מסמן מה נשלח ומה
  // אני מוותר ועדיין ממשיכים להגיע לי עוד ועוד."**
  //
  // נמדד באותו בוקר: 18 נשלחו ו-**22 ויתורים**, כלומר 40 החלטות, והמסך
  // עוד הציג שבעה. בשני הימים שלפניו היו ויתור אחד ושלושה, ולכן זה צף
  // רק כשהוא התחיל להשתמש ב"מוותר" באמת.
  //
  // הסיבה: `left` נגזר מ-`wide_sent_at` בלבד. ויתור הוציא אדם מהתור
  // ולא הקטין את המכסה, ולכן **כל ויתור שאב פנימה שם חדש**, בלי סוף.
  // הספירה בצד הלקוח כן ספרה את שניהם, ולכן זה נראה תקין עד הטעינה
  // הבאה, ואז המסך התמלא מחדש.
  //
  // ויתור הוא עבודה: הוא קרא שם, תפקיד וחברה והחליט. 25 החלטות ביום
  // הן המכסה, ולא משנה לאיזה צד הן נפלו.
  const [{ data: all, error }, { count: sentToday }, { count: skippedToday }] = await Promise.all([
    sb.from('contacts')
      .select('id, full_name, title, company, linkedin_url, contacted_at, '
        + 'wide_sent_at, wide_skipped_at, left_company_at, li_seen_at, first_pitch_at')
      .is('wide_sent_at', null)
      .is('wide_skipped_at', null)
      .not('linkedin_url', 'is', null)
      .limit(4000),
    sb.from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('wide_sent_at', israelDayStart()),
    sb.from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('wide_skipped_at', israelDayStart()),
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

  const sent = sentToday ?? 0;
  const skipped = skippedToday ?? 0;
  const done = sent + skipped;
  const left = Math.max(0, DAILY_TARGET - done);

  const list = (all ?? []) as unknown as ReachContact[];
  const queue = sortQueue(list.filter((c) => eligible(c)
    && (!RECRUITERS_ONLY || bucketOf(c.title) === 'recruiter')));
  const rows: ReachRow[] = queue.slice(0, left).map((c) => ({
    id: c.id,
    name: displayName(c.full_name),
    title: c.title ?? null,
    company: c.company ?? null,
    url: c.linkedin_url ?? null,
    bucket: bucketOf(c.title)!,
    message: wideMessage(c),
  }));

  const pool = queue.length;

  /**
   * למה המאגר קטן ממה שנראה, ומה הוריד כל אחד.
   *
   * 15.11.2026. שאול עצר את השליחה כי "כולן כבר קיבלו ממני לפני כמה
   * חודשים את ההודעה הראשונה". השערים מדווחים כאן מאותה סיבה שהשערים
   * בסריקה מדווחים: "נשארו 40" בלי פירוט הוא מספר שאי אפשר לחקור, והוא
   * גם לא נותן לו דרך לדעת שהניקוי אכן קרה.
   */
  const out = { pitch: 0, thread: 0, agency: 0, bucket: 0, recent: 0 };
  for (const c of list) {
    if (c.left_company_at) continue;
    const b = bucketOf(c.title);
    if (!b) { out.bucket++; continue; }
    if (c.first_pitch_at) { out.pitch++; continue; }
    if (c.li_seen_at) { out.thread++; continue; }
    if (b === 'recruiter' && looksLikeAgency(c.company, c.title)) { out.agency++; continue; }
    // כל השערים האחרים עברו, ולכן מי שאינו זכאי כאן נפל על כלל 60 הימים.
    if (!eligible(c)) out.recent++;
  }

  return (
    <main>
      <div className="head">
        <h1>פנייה רחבה</h1>
        <Link className="more" href="/">← חדר המצב</Link>
      </div>

      <p className="sub">
        פנייה כללית לאנשי קשר שאתה מחובר אליהם, בלי קשר למשרה פתוחה.
        {' '}{DAILY_TARGET} ביום, ובנוסף לכל השאר.
        {RECRUITERS_ONLY ? ' שלב ראשון: מגייסים בלבד.' : ''}
        {' '}נשארו <b>{pool}</b> במאגר.
      </p>

      <details className="reach-msg">
        <summary>◀ מי לא נכנס לתור, ולמה</summary>
        <ul className="reach-why">
          <li><b>{out.pitch}</b> קיבלו את ההודעה הראשונה בגל מאי 2026, בבקשת חברות או בהודעה</li>
          <li><b>{out.thread}</b> כבר יש איתם שיחה פתוחה בלינקדאין</li>
          <li><b>{out.agency}</b> מגייסים, אבל בחברת השמה ולא בחברה שמגייסת לעצמה</li>
          <li><b>{out.recent}</b> פנית אליהם על משרה קונקרטית בפחות מ-60 יום</li>
          <li><b>{out.bucket}</b> התפקיד שלהם אינו גיוס, אינו בתחום ואינו בכיר</li>
        </ul>
      </details>

      <ReachList
        rows={rows}
        sample={wideMessage({ full_name: rows[0]?.name ?? 'Mor Barki' })}
        cvFile={WIDE_CV_FILE}
        target={DAILY_TARGET}
        doneToday={done}
        sentToday={sent}
        skippedToday={skipped}
      />
    </main>
  );
}
