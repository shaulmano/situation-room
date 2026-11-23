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

import { isAgency } from '@/lib/pickContact';

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
  /** כבר קיימת איתו שיחה בלינקדאין. ראה migration 0048. */
  li_seen_at?: string | null;
  /** קיבל את הפנייה הראשונה בגל מאי 2026. ראה migration 0049. */
  first_pitch_at?: string | null;
  /** ענה לו. מי שענה אינו מקבל פנייה שנייה. */
  replied_at?: string | null;
  reply_url?: string | null;
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

/**
 * שם חברה שהוא בעצם עיסוק בהשמה, ולכן אינו חברה שמגייסת לעצמה.
 *
 * 15.11.2026, שאול: "אולי הפנייה צריכה להיות בשלב ראשון רק למגייסות של
 * חברות עם שם החברה ולא סתם כאלו שמופיע להן מגייסת בטייטל."
 *
 * וזה בלט ברשימה: "ייעוץ עצמאי בתחומי HR", "Talent-HR" ו-"N.P.R HR"
 * מול HP ונס טכנולוגיות. מגייסת בחברת השמה לא תביא אותו למשרה בחברה
 * מסוימת, היא תכניס אותו למאגר.
 */
const AGENCY_NAME =
  /(\bhr\b|recruit\w*|talent|staffing|sourcing|headhunt\w*|hunt\w*|manpower|outsourc\w*|placement|human resources|consult\w*|freelance|independiente|עצמאי\w*|השמה|גיוס|כוח אדם|משאבי אנוש|ייעוץ)/i;

/**
 * חברות השמה ששמן אינו מסגיר אותן, **בצד הזה בלבד**.
 *
 * 15.11.2026. `AGENCIES` ב-`pickContact` נושא אזהרה מפורשת: סימון שגוי
 * של חברה אמיתית מוריד אנשי קשר אמיתיים ממסך המכרים, ולכן "ניחוש כאן
 * גרוע מריק". הרשימה הזאת נפרדת ממנו כדי שתוספת כאן לא תיגע שם.
 *
 * נמדד על 25 השורות הראשונות של התור: Experis ו-Maof עברו את התבנית
 * למעלה ושתיהן חברות השמה.
 *
 * **וקבוצת יעל וקורנטק לא נכנסו לכאן בכוונה.** הן בית תוכנה ואינטגרציה,
 * כלומר בדיוק ארגון ה-IT המסורתי ש-`score.py` סופר כמעסיק מועדף. זאת
 * אותה מלכודת שתועדה על 'חשמל': מילה שהיא גם שם של מעסיק אמיתי.
 */
const AGENCY_EXTRA = /(\bexperis\b|\bmaof\b|מאוף|\bsee[.\-]?v\b|\bjobset\b)/i;

/**
 * **והתפקיד נבדק גם הוא, לא רק שם החברה.**
 * "Freelance Human Resources Consultant" אצל "עדי יגורי - הנחיית קבוצות
 * ויחידים" הוא יועץ עצמאי ולא מגייס בחברה, ושם החברה לבדו לא מסגיר זאת.
 */
const AGENCY_TITLE = /(freelance|independent|self.?employed|עצמאי|יועצ\w*|consultant)/i;

export function looksLikeAgency(company?: string | null, title?: string | null): boolean {
  const c = (company ?? '').trim();
  if (!c) return true;          // בלי שם חברה אי אפשר לדעת, ולכן לא נכנס
  // הרשימה המפורשת שכבר קיימת במערכת קודמת לתבנית: SQLink ו-GotFriends
  // הם חברות השמה ואין בשמם שום מילה שמסגירה את זה.
  if (isAgency(c)) return true;
  if (AGENCY_EXTRA.test(c)) return true;
  if (title && AGENCY_TITLE.test(title)) return true;
  return AGENCY_NAME.test(c);
}

/**
 * פנייה שנייה למגייסים.
 *
 * 23.11.2026. שאול: "אתה אומר שנגמרו המגייסות בחברות הייטק בישראל? יש
 * אלפים." נמדד: 680 מגייסים בחברות אמיתיות, ול-634 מהם כבר כתב ולא ענו.
 * הכלל מ-15.11 ("כבר כתבתי להם, זה סתם") הוציא את כולם מהתור. הוא אישר
 * נוסח שני, קצר, שאומר שזה עדכון ולא היכרות.
 */
export function isFollowUp(c: { title?: string | null; li_seen_at?: string | null; first_pitch_at?: string | null }): boolean {
  return bucketOf(c.title) === 'recruiter' && !!(c.li_seen_at || c.first_pitch_at);
}

export function eligible(c: ReachContact, now = Date.now()): boolean {
  if (!c.linkedin_url) return false;
  if (c.wide_sent_at || c.wide_skipped_at) return false;
  if (c.left_company_at) return false;
  const bucket = bucketOf(c.title);
  if (!bucket) return false;
  // שיחה קיימת בלינקדאין פירושה שכבר כתב לו. 15.11.2026: "כולן כבר
  // קיבלו ממני לפני כמה חודשים את ההודעה הראשונה... זה נראה לי סתם
  // שליחה כי גם אז לא ענו לי."
  // 23.11.2026: מגייס בחברה אמיתית שכבר כתבת לו ולא ענה מקבל פנייה שנייה,
  // ראה `isFollowUp`. לכל השאר שיחה קיימת עדיין פוסלת.
  const recruiterFollowUp = bucket === 'recruiter';
  if (c.li_seen_at && !recruiterFollowUp) return false;
  // **וגל מאי 2026 הוא פנייה לכל דבר.** 920 בקשות חברות יצאו אז עם
  // הערה שאומרת "actively looking for my next role as a Senior Program
  // Manager / QA Leader. Happy to send my CV if anything fits", כלומר
  // בדיוק ההודעה הראשונה. ראה migration 0049.
  if (c.first_pitch_at && !recruiterFollowUp) return false;
  if (c.replied_at || c.reply_url) return false;
  // **מגייס, רק אם הוא מגייס של חברה אמיתית.**
  if (bucket === 'recruiter' && looksLikeAgency(c.company, c.title)) return false;
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

/**
 * ערבול יציב ליום אחד: אותו סדר בכל טעינה של אותו יום, סדר אחר מחר.
 *
 * 15.11.2026, שאול: **"עכשיו עדיין יש שם את השמות הקודמים. תמחק."**
 *
 * הוא ראה נכון ופירש לא נכון, ושני החלקים חשובים. השמות לא היו הקודמים:
 * הוא שלח ל-Adi Bonfil, Adi Boni ו-Adi Noyman, והמסך הציג את Adi Baruch,
 * Adi Cohen ו-Adi Engel, כלומר אנשים אחרים לגמרי. **אבל המסך נראה זהה**,
 * כי המיון היה לפי אלף בית ו-2,600 אנשי קשר פירושם שבוע שלם על האות A.
 *
 * מיון לפי שם נבחר כדי ששתי טעינות של אותו יום יראו אותו דבר, וזאת דרישה
 * נכונה: בלעדיה כל סימון היה מערבב את המסך מתחת לידיים. הערבול כאן שומר
 * עליה בלי לשלם באלף בית, כי המפתח הוא המזהה ועוד תאריך היום.
 *
 * **ולמה לא למחוק את מי שהוא ראה, כמו שביקש.** אלה 25 מגייסות פנימיות
 * ב-Placer.ai, ב-Yotpo, ב-NetApp וב-monday.com, והמחיקה הייתה שורפת אותן
 * לתמיד בשביל תקלת תצוגה. "מוותר" קיים בשביל מי שבאמת לא רלוונטי.
 */
function dayHash(id: string, dayKey: string): number {
  let h = 2166136261;
  const s = id + '|' + dayKey;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function sortQueue(rows: ReachContact[], dayKey = israelDayStart().slice(0, 10)): ReachContact[] {
  const r = new Map(rows.map((x) => [x.id, dayHash(x.id, dayKey)]));
  return [...rows].sort((a, b) => {
    const ba = ORDER[bucketOf(a.title)!] ?? 9;
    const bb = ORDER[bucketOf(b.title)!] ?? 9;
    if (ba !== bb) return ba - bb;
    const fa = isFollowUp(a) ? 1 : 0;
    const fb = isFollowUp(b) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const ra = r.get(a.id) ?? 0;
    const rb = r.get(b.id) ?? 0;
    if (ra !== rb) return ra - rb;
    // שובר שוויון יציב, כדי שלא יהיה סדר אקראי כשהגיבוב מתנגש.
    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

export const DAILY_TARGET = 25;

/**
 * כמה הודעות ביום יוצאות אוטומטית מהמחשב.
 *
 * 22.11.2026. שאול שאל "אין סיכוי להיחסם?", והתשובה הייתה שיש סיכון קטן
 * אבל אמיתי: שליחה אוטומטית מנוגדת לתנאי של לינקדאין, והיא מזהה הודעות
 * זהות בקצב קבוע. לכן מתחילים ב-5 ביום ובמרווח של 3 עד 6 דקות
 * (`send_outbox.py`), ומעלים רק אחרי שבוע בלי אזהרה. **אל תעלה בלי לשאול.**
 */
export const AUTO_SEND_PER_DAY = 5;

/**
 * שלב ראשון של הפנייה הרחבה: מגייסים בלבד.
 *
 * 22.11.2026. שאול, על מסך שהציג עמיתים אחד אחרי השני: "אתה מביא לי
 * לפניה רחבה יותר מדי עמיתים ופחות מגייסות ודיברנו על זה. אני רוצה
 * מגייסות שלב ראשון."
 *
 * המיון כבר העמיד מגייסים ראשונים, אבל המאגר שלהם נגמר: נמדד 64 מגייסים
 * פתוחים לפני סינון חברות השמה, ולכן יתר המכסה התמלאה בעמיתים. עכשיו
 * המכסה לא מתמלאת בעמיתים. כשהמגייסים נגמרים המסך אומר את זה.
 * לשלב הבא (עמיתים, בכירים): להפוך ל-false.
 */
export const RECRUITERS_ONLY = true;

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
export function wideMessage(c: ReachContact | { full_name?: string | null; title?: string | null; li_seen_at?: string | null; first_pitch_at?: string | null }): string {
  // 15.11.2026, שאול: "זה יותר אישי". זאת ההתאמה האישית היחידה בהודעה
  // קבועה, ולכן היא שווה את עצמה.
  const name = firstName((c as any).full_name) || 'there';
  if (isFollowUp(c as any)) {
    // הנוסח שאושר ב-23.11.2026, מילה במילה. אל תשנה בלי לשאול.
    return [
      `Hi ${name},`,
      '',
      'I wrote to you a while back when I started looking for my next role. Quick update: ' +
        "I'm still looking for a Program, Project or QA management role in Israel, and I'm attaching my CV. " +
        "If anything is open now, or you hear of something, I'd be glad to talk.",
      'Thanks,',
      'Shaul',
    ].join('\n');
  }
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
