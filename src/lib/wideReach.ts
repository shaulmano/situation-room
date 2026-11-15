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

export function firstName(full?: string | null): string {
  return (full ?? '').trim().split(/\s+/)[0] || '';
}

/**
 * הנוסח. קבוע, אנגלית, קצר, עם קובץ מצורף.
 *
 * שאול, 15.11.2026: "אני חושב שהכל באנגלית" ו"ההודעה צריכה להיות
 * גנרית וקצרה. עם צירוף קורות חיים."
 *
 * **והגרסה הראשונה נפסלה על ידו: "זה לא גנרי. כי בקורות חיים מופיע
 * הכל."** היא פתחה ב-25 שנה, 15 בניהול והתפקיד האחרון בקומרקטס, כלומר
 * חזרה בטקסט על מה שהקובץ המצורף אומר ממילא. מי שמתעניין פותח את
 * הקובץ, ומי שלא, לא יקרא שלוש שורות רקע.
 *
 * מה שנשאר הוא רק מה שהקובץ **לא** אומר: מה הוא מחפש עכשיו, ומה הוא
 * מבקש. שום דבר כאן אינו מומצא.
 */
export function wideMessage(c: ReachContact): string {
  const name = firstName(c.full_name);
  return [
    `Hi ${name},`,
    '',
    'I\'m looking for my next Delivery or Program Manager role in the Tel Aviv area. '
    + 'My CV is attached.',
    '',
    'If you hear of something, or have something open, I\'d appreciate you keeping me '
    + 'in mind.',
    '',
    'Thanks,',
    'Shaul',
  ].join('\n');
}

// הקובץ המאוחד ל-Delivery ול-Program. קיים במסד תחת המזהה program.
export const WIDE_CV_ID = 'program';
