/**
 * הפנייה הרחבה: מי נכנס לתור היומי, ובאיזה סדר.
 *
 * 15.11.2026. שאול ביקש 20 עד 30 אנשי קשר ביום, פנייה כללית לתפקידי
 * Delivery ו-Program, **בנוסף לשוטף ולא במקומו**.
 *
 * הוא בחר שלוש קבוצות ולא את כל אנשי הקשר: מגייסים וגיוס, עמיתים
 * בתחום, ובכירים. "כל מי שבהייטק" נדחה במפורש.
 *
 * **וכולם קשרים מדרגה ראשונה.** נמדד: 2,657 מתוך 2,662 הגיעו מייצוא
 * ה-Connections של לינקדאין, שהוא לפי הגדרה דרגה ראשונה, ולכולם יש
 * קישור פרופיל. לכן אין כאן בקשות חברות ואין מה לנהל, והלחיצה פותחת
 * שיחה ולא בקשה. החמישה שאינם משם נוספו כשאישרו בקשה, כלומר גם הם.
 */

export type ReachBucket = 'recruiter' | 'peer' | 'senior';

export type ReachContact = {
  id: string;
  full_name: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string | null;
  contacted_at?: string | null;
  wide_sent_at?: string | null;
  wide_skipped_at?: string | null;
  left_company_at?: string | null;
};

// מגייס ראשון, כי "VP People" הוא גיוס ולא בכיר לענייננו.
const RECRUITER = /\b(talent|recruit\w*|hr|human resources|people|sourcer|hiring)\b/i;
const SENIOR = /\b(vp|vice president|director|head of|chief|cto|ceo|coo|cio|cpo|founder|co-founder|owner|general manager)\b/i;
const PEER = /\b(delivery|program|project|pmo|qa|quality|release|scrum|agile|test|testing)\b/i;

export function bucketOf(title?: string | null): ReachBucket | null {
  const t = (title ?? '').trim();
  if (!t) return null;
  if (RECRUITER.test(t)) return 'recruiter';
  if (SENIOR.test(t)) return 'senior';
  if (PEER.test(t)) return 'peer';
  return null;
}

export const BUCKET_LABEL: Record<ReachBucket, string> = {
  recruiter: 'גיוס',
  peer: 'עמית בתחום',
  senior: 'בכיר',
};

/**
 * מי לא נכנס, וכל סעיף כאן הוא סיבה אמיתית ולא זהירות סתם.
 *
 * **מי שפנית אליו לאחרונה על משרה קונקרטית לא מקבל גם פנייה כללית.**
 * שתי הודעות באותו שבוע מאותו אדם, אחת על משרה ואחת "אם אתם שומעים על
 * משהו", נקראות כמו מישהו שלא עוקב אחרי מה שהוא שולח. 60 יום.
 */
const RECENT_DAYS = 60;

export function eligible(c: ReachContact, now = Date.now()): boolean {
  if (!c.linkedin_url) return false;
  if (c.wide_sent_at || c.wide_skipped_at) return false;
  if (c.left_company_at) return false;
  if (!bucketOf(c.title)) return false;
  if (c.contacted_at) {
    const days = (now - new Date(c.contacted_at).getTime()) / 864e5;
    if (days < RECENT_DAYS) return false;
  }
  return true;
}

// מגייסים ראשונים: להם הפנייה הזאת היא בדיוק העבודה שלהם, ולכן היא
// לא מטרידה. אחריהם עמיתים, שיודעים על משרה לפני שהיא מתפרסמת, ורק
// אז בכירים.
const ORDER: Record<ReachBucket, number> = { recruiter: 0, peer: 1, senior: 2 };

export function sortQueue(rows: ReachContact[]): ReachContact[] {
  return [...rows].sort((a, b) => {
    const ba = ORDER[bucketOf(a.title)!] ?? 9;
    const bb = ORDER[bucketOf(b.title)!] ?? 9;
    if (ba !== bb) return ba - bb;
    // בתוך קבוצה, סדר יציב לפי שם, כדי ששתי טעינות של אותו יום יראו
    // את אותה רשימה. אחרת סימון אחד היה מערבב את כל המסך.
    return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'he');
  });
}

export const DAILY_TARGET = 25;

/**
 * תחילת היום בשעון ישראל, כ-ISO.
 *
 * הראנר של ורסל רץ ב-UTC, ולכן `setHours(0,0,0,0)` היה סופר את
 * הפניות של אתמול בערב כאילו הן של היום. ההיסט מחושב ולא מקובע, כי
 * ישראל מתחלפת בין שתיים לשלוש שעות.
 */
export function israelDayStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const localAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  const offset = localAsUtc - now.getTime();
  return new Date(Date.UTC(g('year'), g('month') - 1, g('day')) - offset).toISOString();
}

/**
 * השם הפרטי, נקי.
 *
 * 15.11.2026: הראשון בתור נקרא בלינקדאין "★Mor Barki★", וההודעה
 * הייתה יוצאת "Hi ★Mor,". אנשים שמים כוכביות, אימוג'ים ותארים בשם
 * התצוגה, ולכן כל מה שאינו אות יורד לפני הפיצול.
 *
 * אם לא נשאר שם סביר, הפונקציה מחזירה ריק והנוסח נופל ל-"there".
 * **עדיף בלי שם מאשר שם שגוי.**
 */
const TITLES = new Set([
  'dr', 'mr', 'ms', 'mrs', 'miss', 'prof', 'professor', 'eng', 'adv', 'cpa',
  'דר', 'ד', 'עו', 'רו', 'פרופ',
]);

/**
 * השם המלא לתצוגה, בלי כוכביות ובלי אימוג'ים.
 *
 * 15.11.2026, שאול: "בלי הכוכבית ובלי אימוג׳י". זה נוגע גם להודעה וגם
 * לכרטיס עצמו: "★Mor Barki★" על המסך נראה כמו תקלה.
 */
export function displayName(full?: string | null): string {
  const cleaned = (full ?? '').replace(/[^\p{L}\p{M}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || (full ?? '').trim();
}

export function firstName(full?: string | null): string {
  const cleaned = (full ?? '').replace(/[^\p{L}\p{M}\s'-]/gu, ' ').trim();
  for (const w of cleaned.split(/\s+/)) {
    if (w.length < 2) continue;
    if (TITLES.has(w.toLowerCase())) continue;
    return w;
  }
  return '';
}

/**
 * הנוסח, במילים של שאול עצמו.
 *
 * 15.11.2026. שתי גרסאות שלי נפסלו לפניו, וכל אחת לימדה משהו:
 *
 * הראשונה פתחה ב-25 שנה, 15 בניהול והתפקיד האחרון בקומרקטס. שאול:
 * **"זה לא גנרי. כי בקורות חיים מופיע הכל."** וצדק פעמיים: גם חזרה על
 * הקובץ המצורף, וגם **סתרה אותו**, כי הקובץ עצמו כתוב "15+ years in
 * high-tech" ולא 25.
 *
 * השנייה אמרה "in the Tel Aviv area". שאול: **"ואם החברה ברעננה?"**
 * נוסח קבוע לכולם לא יכול לנקוב באזור, והכתובת ממילא בראש הקובץ.
 *
 * מה שנשאר הוא מה שהקובץ לא אומר: מה הוא מחפש, ומה הוא מבקש. **אל
 * תוסיף לזה שורות.** כל תוספת כאן כבר נוסתה ונפסלה.
 */
export function wideMessage(c: ReachContact | { full_name?: string | null }): string {
  // 15.11.2026, שאול: "זה יותר אישי". זאת ההתאמה האישית היחידה בהודעה
  // קבועה, ולכן היא שווה את עצמה.
  const name = firstName((c as any).full_name) || 'there';
  return [
    `Hi ${name},`,
    '',
    "I'm looking for my next Delivery or Program Manager role.",
    'My CV is attached.',
    "If you hear of something, or have something open, I'd appreciate you keeping me in mind.",
    'Thanks,',
    'Shaul',
  ].join('\n');
}

// הקובץ המאוחד ל-Delivery ול-Program. קיים במסד תחת המזהה program.
export const WIDE_CV_ID = 'project-release-manager';

// הקובץ שהוא נתן ב-15.11: Shaul_Mano_Project_Release_Manager.pdf.
// הכותרת שלו היא "Project & Program Manager | Release Manager |
// Delivery | Enterprise SaaS", והוא כבר קיים במסד תחת המזהה הזה.
export const WIDE_CV_FILE = 'Shaul_Mano_Project_Release_Manager.pdf';
