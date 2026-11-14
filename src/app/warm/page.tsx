import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { applyTarget } from '@/lib/apply';
import { jobAge } from '@/lib/age';
import { companyKey, contactsByCompanyKeys, type WarmContact } from '@/lib/contacts';
import { postingKey } from '@/lib/dedupe';
import Dismiss from '@/components/Dismiss';
import JobContacts from '@/components/JobContacts';
import WarmTabs from '@/components/WarmTabs';
import AppliedList, { type AppliedRow } from '@/components/AppliedList';
import MarkApplied from '@/components/MarkApplied';
import LinkedinQueue from '@/components/LinkedinQueue';
import PosterQueue, { type PosterRow } from '@/components/PosterQueue';
import Refresh from '@/components/Refresh';
import WarmPicker, { type Pick } from '@/components/WarmPicker';

export const dynamic = 'force-dynamic';

// המסך הזה נולד ממדידה, 12.11.2026.
//
// 540 הגשות, 22 נפתחו על ידי מגייס, 2 הגיעו לשיחה. זה 0.4%. ובאותו זמן
// יש 771 משרות על המטרה שפתוחות ולא הוגש אליהן, מהן רק 13 מהשבוע האחרון:
// זאת ערימה, לא זרם. כלומר הצוואר אינו מציאת משרות אלא המרה.
//
// ולשאול יש 2,657 אנשי קשר מדרגה ראשונה ב-1,760 חברות, ו-382 מהמשרות
// הפתוחות הן בחברה שהוא מכיר בה מישהו. הוא הגיש אליהן קר.
//
// כל מה שצריך כבר היה בקוד, מקופל בתוך <details> מתחת לשורת משרה, במסך
// עם מאות שורות. המסך הזה לא מוסיף יכולת, הוא מוציא אותה החוצה.

export default async function Warm({
  searchParams,
}: {
  searchParams: { all?: string; tab?: string };
}) {
  const sb = serverClient();
  // ברירת המחדל היא מי שעוד לא פנית אליו. "הכל" מראה גם את מי שכבר פנית.
  const showAll = searchParams.all === '1';

  const [{ data: appliedIdRows }, { data: appliedRows }, { data }] = await Promise.all([
    // 14.11.2026, שאול: "המעבר צריך להיות מהיר כי כרגע הוא ממש איטי. ממש."
    //
    // זאת הייתה השליפה הכבדה כאן: כל 550 ההגשות, כל אחת עם join לטבלת
    // המשרות, בכל טעינה של המסך. מתוכן משתמשים בפרטים המלאים רק בשבעת
    // הימים האחרונים, כלומר בעשרות בודדות. כל השאר נדרש רק בשביל רשימת
    // המזהים של מה שהוגש.
    //
    // לכן שתי שליפות: עמודה אחת על הכל, ו-join רק על השבוע.
    sb.from('applications').select('job_id'),
    sb.from('applications')
      .select('job_id, sent_at, cv_id, company, role, jobs(id, title, company, url, found_for)')
      .gte('sent_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    sb
      .from('matches')
      .select(
        'score, cv_id, reasons, '
        + 'jobs!inner(id, title, company, source, location, url, first_seen, found_for, '
        + 'posted, on_target, dismissed_at)'
      )
      .eq('jobs.on_target', true)
      .is('jobs.dismissed_at', null)
      .order('first_seen', { ascending: false, referencedTable: 'jobs' })
      .limit(3000),
  ]);

  const appliedIds = new Set((appliedIdRows ?? []).map((a: any) => a.job_id));

  // ── הגשה טרייה היא הסיבה לפנות, לא הסיבה להסתיר ────────────────────────
  //
  // 13.11.2026. שאול הגיש ל-Aidoc, ראה שבלוק אנשי הקשר נעלם, ואז: "למה
  // זה לא מופיע במכרים?"
  //
  // כי גם המסך הזה סינן החוצה כל משרה שהוגשה. זה היה הפוך מהכוונה: "הגשתי
  // היום למשרה הזאת אצלכם, תוכלי להעביר פנימה" היא הפנייה החזקה ביותר
  // שיש, הרבה מעבר ל"יש אצלכם משרה פתוחה".
  //
  // שלושים יום ולא תמיד: 238 הגשות מספטמבר כבר לא רלוונטיות, והן היו
  // מציפות את התור בפניות על משרות שמזמן נסגרו.
  // 14.11.2026: השליפה המפורטת היא שבעה ימים, וזה גם החלון של הטאב
  // "השבוע". שאול: "אני לא רוצה להתעסק בחודש האחרון... אנחנו מתחילים
  // ממחר", ולכן אין יותר טעם בשלושים יום.
  const freshlyApplied = new Set((appliedRows ?? []).map((a: any) => a.job_id));

  // ── מי שפרסם משרה שהגשת אליה ───────────────────────────────────────────
  //
  // 13.11.2026. שאול: "על כל שליחה למשרה בלינקדאין אתה תמצא לי את המפרסם
  // ותכניס אותי לשליחת הודעה פרטית".
  //
  // רק הגשות, ורק משרות שיש להן מפרסם. אין מילוי אחורה: משרה שהוגשה לפני
  // שהעמודות נוספו תקבל מפרסם רק אם poster.py יגיע אליה, והוא רץ על שבוע
  // אחורה בלבד.
  const { data: postedRows } = await sb
    .from('applications')
    .select(
      'job_id, cv_id, sent_at, '
      + 'jobs!inner(id, title, company, url, found_for, recruiter_name, recruiter_url, '
      + 'poster_request_at, poster_sent_at, poster_replied_at, poster_skipped_at)'
    )
    .not('jobs.recruiter_name', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(200);

  // האם שאול מחובר למפרסם. זה קובע איזו הודעה מוצגת: למחובר הודעה עם
  // קובץ, ולמי שלא פתק בבקשת חברות בלי קובץ. נשאל רק על המפרסמים שעל
  // המסך ולא על כל אנשי הקשר: משיכה של 2,657 שורות בכל רינדור היא בדיוק
  // מה שרוקן את תקציב ה-IO ב-12.11.
  const slugOf = (u?: string | null) =>
    ((u ?? '').match(/\/in\/([A-Za-z0-9\-_%]+)/)?.[1] ?? '').toLowerCase();
  const posterSlugs = [...new Set(
    (postedRows ?? []).map((a: any) => slugOf(a.jobs?.recruiter_url)).filter(Boolean)
  )];
  const { data: knownPosters } = posterSlugs.length
    ? await sb.from('contacts').select('linkedin_url')
        .or(posterSlugs.map((s) => `linkedin_url.ilike.%/in/${s}%`).join(','))
    : { data: [] as any[] };
  const knownSlugs = new Set(
    (knownPosters ?? []).map((c: any) => slugOf(c.linkedin_url)).filter(Boolean)
  );

  // כרטיס אחד לאדם ולא אחד למשרה. נמדד ב-13.11: מתוך 17 ההגשות שיש להן
  // מפרסם, שלושה אנשים פרסמו שתיים כל אחד. שני כרטיסים לאותו אדם היו
  // אומרים שתי בקשות חברות, ולינקדאין מאפשרת אחת.
  //
  // המשרות מגיעות ממוינות לפי תאריך הגשה יורד, ולכן הראשונה שנרשמת היא
  // האחרונה שהוגשה, וזאת שההודעה מדברת עליה.
  const postedWithPoster = new Set(
    ((postedRows ?? []) as any[])
      .filter((a) => a.jobs?.recruiter_name)
      .map((a) => a.job_id as string)
  );

  const byPoster = new Map<string, PosterRow>();
  for (const a of (postedRows ?? []) as any[]) {
    const slug = slugOf(a.jobs?.recruiter_url);
    if (!slug || !a.jobs?.recruiter_url) continue;
    const prev = byPoster.get(slug);
    if (prev) {
      prev.jobIds.push(a.jobs.id);
      if (a.jobs.title && !prev.alsoTitles.includes(a.jobs.title)
          && a.jobs.title !== prev.title) {
        prev.alsoTitles.push(a.jobs.title);
      }
      // הסטטוס הוא של האדם: די בכך שסומן על אחת מהמשרות שלו.
      prev.requestAt ??= a.jobs.poster_request_at ?? null;
      prev.sentAt ??= a.jobs.poster_sent_at ?? null;
      prev.repliedAt ??= a.jobs.poster_replied_at ?? null;
      prev.skippedAt ??= a.jobs.poster_skipped_at ?? null;
      continue;
    }
    byPoster.set(slug, {
      jobIds: [a.jobs.id],
      title: a.jobs.title,
      company: a.jobs.company ?? '',
      cvId: a.cv_id ?? null,
      foundFor: a.jobs.found_for ?? null,
      url: a.jobs.url ?? null,
      posterName: a.jobs.recruiter_name as string,
      posterUrl: a.jobs.recruiter_url as string,
      connected: knownSlugs.has(slug),
      alsoTitles: [],
      appliedAt: a.sent_at ?? null,
      requestAt: a.jobs.poster_request_at ?? null,
      sentAt: a.jobs.poster_sent_at ?? null,
      repliedAt: a.jobs.poster_replied_at ?? null,
      skippedAt: a.jobs.poster_skipped_at ?? null,
    });
  }
  const posters: PosterRow[] = [...byPoster.values()];

  // שורה אחת למשרה, הגרסה שקיבלה את הניקוד הגבוה ביותר.
  const best = new Map<string, any>();
  for (const m of (data ?? []) as any[]) {
    const id = m.jobs?.id;
    if (!id) continue;
    if (!best.has(id) || best.get(id).score < m.score) best.set(id, m);
  }

  // ואז שורה אחת לפרסום, כי אותה משרה מופיעה בכמה לוחות.
  const merged = new Map<string, any[]>();
  for (const m of best.values()) {
    const k = postingKey(m.jobs.company, m.jobs.title);
    const list = merged.get(k) ?? [];
    list.push(m);
    merged.set(k, list);
  }

  const postings = [...merged.values()]
    // הגשה ישנה יורדת, הגשה טרייה נשארת ונושאת איתה את הידיעה שהגשת.
    .filter((list) => !list.some(
      (m) => appliedIds.has(m.jobs.id) && !freshlyApplied.has(m.jobs.id)))
    .map((list) => {
      const order = [...list].sort((a, b) => {
        const indirect = (m: any) => (applyTarget(m.jobs)?.indirect ? 1 : 0);
        return indirect(a) - indirect(b)
          || new Date(b.jobs.first_seen).getTime() - new Date(a.jobs.first_seen).getTime();
      });
      return { ...order[0], copies: order };
    });

  // אנשי הקשר, לפי אותו מפתח חברה שמשמש בייבוא. בלעדיו "Qmarkets Ltd."
  // ו-"Qmarkets" הן שתי חברות.
  // 13.11.2026: גם החברות שהוגשו היום, ולא רק המשרות שעל המטרה. ההגשה
  // של Director of GenAI Operations ב-Aidoc לא נשאה אף אחת ממילות המפתח
  // של on_target, ולכן החברה שלה לא נכנסה לרשימת המפתחות בכלל, והסקשן
  // "הגשת היום" יצא ריק בזמן שיש שם שני אנשי קשר.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRows = (appliedRows ?? []).filter(
    (a: any) => a.sent_at && new Date(a.sent_at).getTime() >= todayStart.getTime());

  // 14.11.2026, שאול: "תתחיל מהשבוע האחרון ואם זה מסובך מעכשיו". שבוע
  // ולא חודש: הגשה מלפני חודשיים היא כבר לא משהו שמרימים, ורשימה של 326
  // שורות היא לא רשימת עבודה אלא עוד ערימה.
  const WEEK_DAYS = 7;
  const weekFrom = Date.now() - WEEK_DAYS * 864e5;
  const weekRows = (appliedRows ?? []).filter(
    (a: any) => a.sent_at && new Date(a.sent_at).getTime() >= weekFrom);

  const keys = [...new Set([
    ...postings.map((m) => companyKey(m.jobs.company)),
    ...weekRows.map((a: any) => companyKey(a.jobs?.company ?? a.company)),
  ].filter(Boolean))];
  const select = 'id, full_name, title, company_key, linkedin_url, email, phone, contacted_at, replied_at, skipped_at';
  const contacts = await contactsByCompanyKeys(sb, keys, select);

  // 12.11.2026. מפתח ריק אינו התאמה. 81 משרות פתוחות הגיעו בלי שם חברה,
  // ול-4 אנשי קשר אין שם חברה בייבוא, ושני הצדדים נורמלו לאותה מחרוזת
  // ריקה. התוצאה: ארבעת האנשים הותאמו לכל 81 המשרות, וזה היה רוב הרשימה
  // על המסך. מי שאין לו שם חברה לא מתאים לאף אחד, בשני הכיוונים.
  const warm = new Map<string, WarmContact[]>();
  for (const c of contacts as any[]) {
    const k = (c.company_key ?? '').trim();
    if (!k) continue;
    const list = warm.get(k) ?? [];
    list.push(c);
    warm.set(k, list);
  }

  // ── הגשת היום ──────────────────────────────────────────────────────────
  //
  // 13.11.2026, שאול: "הוא צריך להופיע בסקשיין עליון. תחת הגשת היום."
  //
  // מה שהגשת היום ואתה מכיר שם מישהו הוא הדבר הדחוף ביותר על המסך הזה:
  // ההגשה טרייה בערימה, והפנייה הפנימית היא מה שמרים אותה משם. קבור
  // בתוך תור של 128 שורות הוא לא נמצא, וזה בדיוק מה שקרה עם Aidoc.
  const todaySeen = new Set<string>();
  const todayApplied = todayRows
    .map((a: any) => {
      const company = a.jobs?.company ?? a.company ?? '';
      return {
        id: a.job_id as string,
        title: a.jobs?.title ?? a.role ?? '',
        company,
        cvId: a.cv_id ?? null,
        url: a.jobs?.url ?? null,
        foundFor: a.jobs?.found_for ?? null,
        people: (warm.get(companyKey(company)) ?? []).filter((p) => !alreadyMessaged(p)),
        openCount: (warm.get(companyKey(company)) ?? [])
          .filter((p) => !p.contacted_at && !alreadyMessaged(p)).length,
      };
    })
    // רק כאלה שיש בהן למי לפנות. הגשה בלי מכר בחברה אינה פריט פעולה כאן.
    .filter((r) => r.people.length > 0)
    .filter((r) => (todaySeen.has(r.id) ? false : (todaySeen.add(r.id), true)));

  // ── מי שכבר קיבל ממך הודעה דרך טאב המפרסמים ────────────────────────────
  //
  // 14.11.2026. טליה נובק נינו פרסמה את שתי משרות מרטנס, שאול פנה אליה שם,
  // ואז היא הוצגה שוב בטאב "השבוע" כאילו לא פנה. אותו אדם, שני מסכים, ואף
  // אחד מהם לא ידע על השני. פנייה שלישית לאותו אדם באותו שבוע היא בדיוק מה
  // שגורם לו להפסיק לענות.
  //
  // ההצלבה לפי ה-slug של הפרופיל, כמו במקום היחיד האחר שמשווה פרופילים.
  const messagedSlugs = new Set(
    posters
      .filter((r) => r.sentAt || r.requestAt)
      .map((r) => slugOf(r.posterUrl))
      .filter(Boolean)
  );
  const alreadyMessaged = (c: { linkedin_url?: string | null }) =>
    messagedSlugs.has(slugOf(c.linkedin_url));

  // הגשות השבוע שיש בהן למי לפנות, חוץ מאלה של היום שיושבות בטאב שלהן.
  // מי שכבר פנית אליו לא מופיע: הטאב הזה הוא רשימת עבודה, לא ארכיון.
  // כרטיס אחד לחברה ולא אחד למשרה: מרטנס הופיעה פעמיים עם אותו איש
  // קשר, כלומר שתי הודעות זהות לאותו אדם באותו יום.
  const weekSeen = new Map<string, AppliedRow>();
  const weekMapped = weekRows
    .map((a: any) => {
      const company = a.jobs?.company ?? a.company ?? '';
      const all = warm.get(companyKey(company)) ?? [];
      const sent = new Date(a.sent_at).getTime();
      return {
        key: companyKey(company) || (a.job_id as string),
        jobId: a.job_id as string,
        company,
        alsoTitles: [] as string[],
        title: a.jobs?.title ?? a.role ?? '',
        cvId: a.cv_id ?? null,
        url: a.jobs?.url ?? null,
        foundFor: a.jobs?.found_for ?? null,
        days: Math.max(0, Math.floor((Date.now() - sent) / 864e5)),
        sentAt: sent,
        // 14.11.2026: מי שפנית אליו נשאר בשורה ורק נצבע. שאול: "פניתי
        // וסימנתי וכלום לא קורה... צריך לצבוע אותה בצבע אחר. ולשמור אותה."
        // הסינון היחיד שנשאר הוא מי שכבר קיבל הודעה בטאב המפרסמים, כדי
        // לא לשלוח לאותו אדם פעמיים.
        people: all.filter((p) => !alreadyMessaged(p)),
        openCount: all.filter((p) => !p.contacted_at && !alreadyMessaged(p)).length,
      };
    })
    .filter((r) => r.people.length > 0 && !todaySeen.has(r.jobId))
    // מי שעוד מחכה למעלה, מה שטיפלת בו נשאר למטה כעדות ליום העבודה.
    .sort((a, b) => (b.openCount > 0 ? 1 : 0) - (a.openCount > 0 ? 1 : 0)
      || b.sentAt - a.sentAt);

  for (const r of weekMapped) {
    const prev = weekSeen.get(r.key);
    if (!prev) { weekSeen.set(r.key, r); continue; }
    if (r.title && r.title !== prev.title && !prev.alsoTitles.includes(r.title)) {
      prev.alsoTitles.push(r.title);
    }
  }
  const appliedWeek: AppliedRow[] = [...weekSeen.values()];

  // כמה הגשות מהשבוע לא קיבלו מפרסם. 14.11.2026: בלי המספר הזה, משרה
  // שהוגשה ואין לה מפרסם פשוט לא מופיעה בטאב, וזה נראה בדיוק כמו תקלה.
  const noPosterCount = weekRows.filter(
    (a: any) => (a.jobs?.url ?? '').includes('linkedin.com')
      && !postedWithPoster.has(a.job_id)
  ).length;

  const withContacts = postings
    .map((m) => {
      const k = companyKey(m.jobs.company);
      return { m, people: k ? warm.get(k) ?? [] : [] };
    })
    .filter((r) => r.people.length > 0);

  // התור: מה שכבר סומן לשליחה, כדי שהמסך ידע מה מצבו ולא יציע אותו שוב.
  // 12.11.2026: גם הנוסח וגם מצב הקובץ, כי הבדיקה עברה מהמייל למסך.
  // pdf_base64 עצמו לא נשלף: הוא מאות אלפי תווים, והמסך צריך רק לדעת
  // אם הוא קיים. הקובץ עצמו נמשך לפי דרישה מ-/api/outreach/cv.
  const { data: queued } = await sb
    .from('referrals')
    .select('id, contact_id, job_id, cv_id, status, subject, body');

  // 13.11.2026: הקובץ נקרא גם מ-cv_requests, ולא רק מההעתקה שבשורת
  // הפנייה. ההעתקה הזאת נעשית בתוך השולח, שרץ רק אחרי שהפנייה אושרה,
  // ולכן נוצר מעגל: הקובץ חיכה לאישור והאישור חיכה לקובץ. שלוש פניות
  // הציגו "קורות החיים עוד נוצרים" בזמן שהקובץ היה מוכן שעות קודם.
  // 13.11.2026: הקובץ המצורף הוא קובץ הבסיס של שאול לפי משפחת
  // התפקידים, ולא הגרסה שהמחולל כתב למשרה. לכן "מוכן לשליחה" נמדד מול
  // טבלת הגרסאות, לא מול תור הייצור. קודם זה נמדד מול cv_requests,
  // וזה היה חוסם שליחה כשקובץ הבסיס היה מוכן מזמן.
  const { data: cvFiles } = await sb
    .from('cvs')
    .select('id, filename, pdf_base64')
    .not('pdf_base64', 'is', null);
  const haveFile = new Map<string, string>();
  for (const c of (cvFiles ?? []) as any[]) haveFile.set(c.id, c.filename);

  const queuedBy = new Map<string, any>();
  for (const q of (queued ?? []) as any[]) {
    const name = haveFile.get(q.cv_id ?? 'qa') ?? haveFile.get('qa');
    queuedBy.set(`${q.contact_id}|${q.job_id}`, {
      id: q.id, status: q.status, subject: q.subject, body: q.body,
      filename: name ?? null,
      cvReady: !!name,
    });
  }

  // שורה אחת לאדם, לא שורה לכל צמד איש־משרה.
  //
  // 12.11.2026. מאחורי עשרים הפניות שהמסך הציע עמדו חמישה אנשים: כל אחד
  // הופיע על שלוש־ארבע משרות באותה חברה. "סמן הכל" היה שולח לאותו אדם
  // ארבעה מיילים נפרדים בתוך כמה שעות, וזה מה שהורג ערוץ חם. שאול בחר
  // מייל אחד לאדם, על המשרה שקיבלה את הניקוד הגבוה ביותר אצלו.
  //
  // שורה שכבר בתור גוברת על הבחירה הזאת, אחרת סימון שכבר יצא היה נעלם
  // מהמסך ברגע שמשרה חדשה יותר נכנסה לאותה חברה.
  const byContact = new Map<string, Pick>();
  for (const { m, people } of withContacts) {
    for (const c of people) {
      const pick: Pick = {
        contact: c,
        job: {
          id: m.jobs.id, title: m.jobs.title,
          company: m.jobs.company, cvId: m.cv_id ?? null,
          foundFor: m.jobs.found_for ?? null,
          url: m.jobs.url ?? null,
          applied: appliedIds.has(m.jobs.id),
        },
        queued: queuedBy.get(`${c.id}|${m.jobs.id}`) ?? null,
        score: m.score ?? 0,
      };
      const prev = byContact.get(c.id);
      if (!prev) { byContact.set(c.id, pick); continue; }
      if (prev.queued) continue;
      if (pick.queued || pick.score > prev.score) byContact.set(c.id, pick);
    }
  }
  const picks: Pick[] = [...byContact.values()];

  const freshCount = withContacts.filter(
    (r) => !r.people.every((p) => p.contacted_at)
  ).length;

  const rows = (showAll
    ? withContacts
    : withContacts.filter((r) => !r.people.every((p) => p.contacted_at))
  ).sort((a, b) => {
    // מי שיש בו יותר אנשים שעוד לא פנית אליהם קודם, ואז המשרה החדשה יותר.
    const open = (r: typeof a) => r.people.filter((p) => !p.contacted_at).length;
    return open(b) - open(a)
      || new Date(b.m.jobs.first_seen).getTime() - new Date(a.m.jobs.first_seen).getTime();
  });

  const todayPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {todayApplied.length === 0 ? (
        <div className="empty">
          <strong>לא הגשת היום למשרה בחברה שאתה מכיר בה מישהו</strong>
          <span>
            ברגע שתסמן משרה כהוגשה, אם אתה מכיר שם מישהו היא תופיע כאן
            עם ההודעה מוכנה.
          </span>
        </div>
      ) : todayApplied.map((r) => (
        <div
          key={r.id}
          style={{
            background: 'var(--raised)', border: '1px solid var(--hair)',
            borderRadius: 7, padding: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '.86rem' }}>{r.company}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{r.title}</div>
          <JobContacts
            contacts={r.people}
            job={{
              company: r.company, title: r.title, cvId: r.cvId,
              url: r.url, foundFor: r.foundFor, applied: true,
            }}
            open
          />
        </div>
      ))}
    </div>
  );

  const openJobsPanel = (
    <div>
      <div className="filters">
        <Link href="/warm" className={'filter' + (showAll ? '' : ' on')}>
          שלא פנית
          <span className="n">{freshCount}</span>
        </Link>
        <Link href="/warm?all=1" className={'filter' + (showAll ? ' on' : '')}>
          הכל
          <span className="n">{withContacts.length}</span>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <strong>{withContacts.length === 0 ? 'אין כרגע משרה בחברה שאתה מכיר בה מישהו' : 'פנית לכולם'}</strong>
          <span>
            {withContacts.length === 0
              ? 'ברגע שתיכנס משרה בחברה כזאת היא תופיע כאן.'
              : 'אפשר לראות את מי שכבר פנית אליו בלשונית "הכל".'}
          </span>
        </div>
      ) : (
        <div className="rows">
          {rows.map(({ m, people }) => {
            const j = m.jobs;
            const open = people.filter((p) => !p.contacted_at).length;
            const t = applyTarget(j);
            return (
              <div className="row job" key={j.id}>
                <span className="grow">
                  {j.title}
                  <span className="sub">
                    {[j.company, j.location].filter(Boolean).join(' \u00b7 ')}
                  </span>
                  <span className="why">
                    <span className="chip ok">
                      {open > 0
                        ? `${open} ${open === 1 ? 'מכר' : 'מכרים'} שלא פנית`
                        : 'פנית לכולם'}
                    </span>
                    {(() => {
                      const a = jobAge(j.posted, j.first_seen);
                      return a ? <span className={'chip ' + a.tone}>{a.label}</span> : null;
                    })()}
                    <span className="chip src">{j.source}</span>
                  </span>
                </span>

                {t && (
                  <a
                    className={'apply' + (t.indirect ? ' indirect' : '')}
                    href={t.href} target="_blank" rel="noreferrer"
                  >
                    {t.label}
                  </a>
                )}
                <MarkApplied id={j.id} cvId={m.cv_id} />
                <Dismiss id={j.id} ids={m.copies.map((c: any) => c.jobs.id)} noRefresh />

                <JobContacts
                  contacts={people}
                  job={{ company: j.company, title: j.title, cvId: m.cv_id,
                         url: j.url, foundFor: j.found_for,
                         applied: appliedIds.has(j.id) }}
                  open
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // כל טאב הוא עבודה אחת, עם מספר שאומר כמה נשאר ומשפט שאומר מה עושים בו.
  // 14.11.2026, שאול: "שלא יהיו לי שאלות איפה זה ומה אני עושה עם זה".
  const tabs = [
    {
      id: 'today',
      label: 'היום',
      count: todayApplied.filter((r) => r.openCount > 0).length,
      note: 'הגשת היום לחברה שאתה מכיר בה מישהו. ההגשה עוד על השולחן אצלם, '
        + 'והודעה אחת היום מרימה אותה מהערימה. לחץ "פנייה" ליד מי שתבחר, '
        + 'העתק, צרף את הקובץ שרשום, ושלח בלינקדאין או במייל.',
      panel: todayPanel,
    },
    {
      id: 'week',
      label: 'השבוע',
      count: appliedWeek.filter((r) => r.openCount > 0).length,
      note: 'הגשות משבעת הימים האחרונים שעוד לא פנית לאף אחד בחברה שלהן. '
        + 'אותה עבודה בדיוק כמו בטאב "היום", רק על מה שפספסת. מעבר לשבוע '
        + 'כבר מאוחר מדי, ולכן זה לא מופיע כאן.',
      panel: <AppliedList rows={appliedWeek} />,
    },
    {
      id: 'email',
      label: 'במייל',
      count: picks.filter((p) => p.contact.email && !p.contact.contacted_at).length,
      note: 'האנשים היחידים שיש להם כתובת מייל שמורה. כאן המערכת שולחת בשבילך: '
        + 'קרא את ההודעה, לחץ "שלח אלי לבדיקה" אם אתה רוצה לראות אותה אצלך קודם, '
        + 'ואז "שלח". קורות החיים מצורפים אוטומטית.',
      panel: <WarmPicker picks={picks} />,
    },
    {
      id: 'linkedin',
      label: 'בלינקדאין',
      count: picks.filter((p) => !p.contact.email && !p.contact.contacted_at).length,
      note: 'לאלה אין כתובת מייל, ולכן השליחה היא שלך: העתק את ההודעה, צרף את '
        + 'הקובץ שרשום בשורה, שלח בלינקדאין, ואז סמן "שנשלח" כדי שירד מהתור. '
        + 'חמישה עשר ביום זה כל התור בשלושה שבועות.',
      panel: <LinkedinQueue picks={picks} />,
    },
    {
      id: 'posters',
      label: 'מפרסמים',
      count: posters.filter((r) => !r.sentAt && !r.skippedAt).length,
      note: 'מי שפרסם בלינקדאין משרה שהגשת אליה. זה לא מכר שלך אלא מי שמחזיק '
        + 'את המשרה עצמה. למי שאתה מחובר אליו שלח הודעה עם הקובץ, ולמי שלא '
        + 'שלח קודם בקשת חברות עם הפתק, והקובץ בהודעה אחרי שהיא תאושר.',
      panel: <PosterQueue rows={posters} noPoster={noPosterCount} />,
    },
    {
      id: 'open',
      label: 'משרות פתוחות',
      count: freshCount,
      note: 'משרות שעוד לא הגשת אליהן, בחברות שאתה מכיר בהן מישהו. כאן הסדר '
        + 'הפוך: קודם מגישים דרך הכפתור, ואז פונים למכר כדי שההגשה לא תישאר '
        + 'בערימה.',
      panel: openJobsPanel,
    },
  ];

  return (
    <main>
      <h2>דרך מישהו שאתה מכיר</h2>

      <p className="screen-note">
        ‏540 הגשות קרות הביאו 22 פתיחות ושתי שיחות. כל מה שכאן הוא בחברות שאתה
        מכיר בהן מישהו אישית. כל טאב הוא עבודה אחת, והמספר עליו הוא כמה נשאר בה.
      </p>

      {/* 14.11.2026: חזרה לחדר המצב. שאול: "אלה שני המקומות שאני עובד
          איתם", ושני המעברים צריכים להיות לחיצה אחת ומיידיים. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0 12px' }}>
        <Link
          href="/"
          prefetch
          className="apply"
          style={{
            flex: 1, textAlign: 'center', padding: '.7em',
            fontSize: '.9rem', fontWeight: 800,
          }}
        >
          ← חזרה לחדר המצב
        </Link>
        <Refresh />
      </div>

      <WarmTabs tabs={tabs} initial={searchParams.tab} />
    </main>
  );
}
