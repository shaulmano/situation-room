import type { WarmContact } from '@/lib/contacts';

// למי לכתוב, כששאול מכיר תשעה אנשים באותה חברה.
//
// 14.11.2026. הוא שלח צילום של SQLink עם עשרה אנשי קשר ושאל "אם כן מה אני
// אמור לעשות פה?". למחרת הטאב החדש נפתח על מרטנס עם תשעה. תשעה כרטיסים
// בלי סדר הם לא תשע הזדמנויות, הם שאלה פתוחה.
//
// שני דברים שונים נפתרים כאן, ואסור לבלבל ביניהם:
//
// 1. **סדר.** האדם שהכי שווה לכתוב לו עולה למעלה, תמיד. זה חל על כל חברה,
//    גם על IAI ועל מאנדיי שבהן שאול פשוט מכיר כמה מגייסות.
// 2. **חברת השמה.** שם הבקשה "תעביר פנימית למגייסים" חסרת משמעות, כי הם
//    המגייסים, והם גם לא עובדים אצל המעסיק. פנייה אחת מספיקה.
//
// מדוע רשימה מפורשת ולא רק אחוזים: מדידה ב-14.11 הראתה שסף של חמישים אחוז
// מגייסים תופס את IAI (67%), מאנדיי (57%), רדוור ופיירבלוקס. אלה מעסיקות
// אמיתיות שהן בדיוק המטרה של שאול, וסימון שלהן כחברת השמה היה מוריד לו
// שמונה אנשי קשר אמיתיים מהמסך. ניחוש כאן גרוע מריק.

/** חברות שכל עיסוקן השמה והשמת עובדים אצל לקוחות. */
const AGENCIES = [
  'sqlink', 'gotfriends', 'got friends', 'mertens', 'מרטנס',
  'digitalhunters', 'digital hunters', 'ethosia', 'אתוסיה',
  'nisha', 'נישה', 'manpower', 'מנפאואר', 'danel', 'דנאל',
  'niloosoft', 'jobinfo', 'adam milo', 'אדם מילוא',
  'secretjobs', 'secret jobs', 'hunter', 'headhunt',
];

const RECRUITER_RE =
  /(recruit|talent acquisition|sourcing|headhunt|hrbp|human resources|hr business|גיוס|משאבי אנוש)/i;

/** בכירות בתוך התפקיד. מנהלת גיוס תזיז יותר ממגייסת זוטרה. */
const SENIOR_RE =
  /(chief|cpo|vp|vice president|head of|director|team lead|manager|מנהל|סמנכ)/i;

export function isAgency(company?: string | null): boolean {
  const c = (company ?? '').toLowerCase();
  return !!c && AGENCIES.some((a) => c.includes(a));
}

export function isRecruiterTitle(title?: string | null): boolean {
  return RECRUITER_RE.test(title ?? '');
}

/**
 * ניקוד של איש קשר ביחס למשרה. גבוה יותר עולה למעלה.
 *
 * הסדר מכוון: עמית בתחום של המשרה הוא הפנייה החזקה ביותר, כי הוא יכול
 * לומר "אני מכיר אותו" ולא רק להעביר קובץ. אחריו מי שמחזיק את הגיוס
 * בפועל, ובסוף מגייסת זוטרה.
 */
export function contactScore(
  c: WarmContact,
  jobTitle?: string | null,
  agency = false,
): number {
  const t = (c.title ?? '').toLowerCase();
  const recruiter = isRecruiterTitle(c.title);
  const senior = SENIOR_RE.test(c.title ?? '');

  // חפיפת תחום בין התפקיד שלו לכותרת המשרה: qa, project, program, release.
  const job = (jobTitle ?? '').toLowerCase();
  const domains = ['qa', 'quality', 'test', 'project', 'program', 'release', 'delivery', 'pmo'];
  const shared = domains.some((d) => t.includes(d) && job.includes(d));

  let n = 0;
  if (agency) {
    // 14.11.2026. בחברת השמה הסדר הפוך: אין שם "עמית בתחום" ואין פנייה
    // פנימית, כי כל החברה עוסקת באיוש. מי שמחזיק את הגיוס הוא מי שמחזיק
    // את המשרה. הדירוג הרגיל בחר במרטנס את Account Manager על פני
    // Tech Recruitment Team Lead, רק כי "manager" נקרא כבכירות שאינה בגיוס.
    if (recruiter && senior) n += 6;
    else if (recruiter) n += 4;
    else if (senior) n += 2;
    else n += 1;
  } else if (!recruiter && shared) n += 6;   // עמית בתחום, הפנייה החזקה ביותר
  else if (!recruiter && senior) n += 4; // בכיר בחברה, לא בגיוס
  else if (recruiter && senior) n += 3;  // מי שמחזיק את הגיוס
  else if (recruiter) n += 1;            // מגייסת זוטרה
  else n += 2;                           // עובד אחר בחברה

  if (c.email) n += 1;        // אפשר לשלוח לו מהמערכת, בלי עבודה ידנית
  if (c.contacted_at) n -= 10; // כבר פנית, לא ראש הרשימה
  return n;
}

export function rankContacts(
  cs: WarmContact[],
  jobTitle?: string | null,
  agency = false,
): WarmContact[] {
  return [...cs].sort(
    (a, b) => contactScore(b, jobTitle, agency) - contactScore(a, jobTitle, agency));
}
