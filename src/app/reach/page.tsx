import Link from 'next/link';
import { serverClient } from '@/lib/server';
import ReachList, { type ReachRow } from '@/components/ReachList';
import {
  AUTO_SEND_PER_DAY, DAILY_TARGET, RECRUITERS_ONLY, WIDE_CV_FILE, bucketOf, displayName, eligible, isFollowUp, israelDayStart,
  agencyBlocked, sortQueue, wideMessage, type ReachContact,
} from '@/lib/wideReach';

export const dynamic = 'force-dynamic';

/**
 * שליפת המאגר בדפים של 1000.
 *
 * 22.11.2026. שאול: "אין שום משימות לשליחה בפנייה רחבה". `.limit(4000)`
 * אינו עוקף את התקרה של PostgREST, שמחזיר לכל היותר 1000 שורות. בלי מיון
 * זה היה 1000 הראשונות לפי סדר פיזי מתוך כ-2,300, והמגייסים ישבו בעיקר
 * מעבר לגבול. עד שהמסך סונן למגייסים בלבד זה נראה כמו "יותר מדי עמיתים",
 * ובשלב הזה זה נראה כמו מסך ריק. **תקרה שקטה: אותו דפוס כמו `limit` ב-warm.**
 */
async function fetchPool(sb: ReturnType<typeof serverClient>) {
  const rows: any[] = [];
  for (let from = 0; from < 6000; from += 1000) {
    const { data, error } = await sb.from('contacts')
      .select('id, full_name, title, company, linkedin_url, contacted_at, '
        + 'wide_sent_at, wide_skipped_at, left_company_at, li_seen_at, first_pitch_at, replied_at, reply_url')
      .is('wide_sent_at', null)
      .is('wide_skipped_at', null)
      .not('linkedin_url', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: rows, error: null };
}

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
  const [{ data: all, error }, { count: sentToday }, { count: skippedToday }, { count: autoToday }] = await Promise.all([
    fetchPool(sb),
    sb.from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('wide_sent_at', israelDayStart()),
    sb.from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('wide_skipped_at', israelDayStart()),
    sb.from('li_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'wide')
      .gte('queued_at', israelDayStart()),
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
    followUp: isFollowUp(c),
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
    if (c.replied_at || c.reply_url) { out.thread++; continue; }
    if (c.first_pitch_at && b !== 'recruiter') { out.pitch++; continue; }
    if (c.li_seen_at && b !== 'recruiter') { out.thread++; continue; }
    if (b === 'recruiter' && agencyBlocked(c.company, c.title)) { out.agency++; continue; }
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
          <li><b>{out.thread}</b> ענו לך, או שיש איתם שיחה פתוחה והם אינם מגייסים</li>
          <li><b>{out.agency}</b> מגייסים בלי שם חברה, או יועצים ועצמאים</li>
          <li><b>{out.recent}</b> פנית אליהם על משרה קונקרטית בפחות מ-60 יום</li>
          <li><b>{out.bucket}</b> התפקיד שלהם אינו גיוס, אינו בתחום ואינו בכיר</li>
        </ul>
      </details>

      <ReachList
        rows={rows}
        sample={rows[0]?.message ?? wideMessage({ full_name: 'Mor Barki' })}
        cvFile={WIDE_CV_FILE}
        target={DAILY_TARGET}
        doneToday={done}
        sentToday={sent}
        skippedToday={skipped}
        exhausted={pool === 0}
        autoLeft={Math.max(0, AUTO_SEND_PER_DAY - (autoToday ?? 0))}
      />
    </main>
  );
}
