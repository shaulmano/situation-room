import { companyKey } from '@/lib/contacts';
import { postingKey } from '@/lib/dedupe';

/**
 * "יש לי תחושה שהגשתי כבר למשרות האלו."
 *
 * 15.11.2026. שאול ראה Release Manager ב-VAST Data כמשרה חדשה, והוא כבר
 * הגיש אליה ב-2.11 דרך לינקדאין. השורה החדשה הגיעה מ-Indeed דרך ג'וביפיי
 * בכתובת אחרת, **והזיהוי במערכת הוא לפי כתובת**, ולכן היא נראתה חדשה
 * לגמרי. זה בדיוק הדפוס המתועד כ"אין איחוד כפילויות בין מקורות", שצף כאן
 * בפעם השלישית: פעם ברדאר מול חדר המצב, פעם בתוך Workday עצמו בגלל מקטע
 * השפה, וכאן בין לוח ללוח.
 *
 * **"אתה צריך לחפש לפי שם חברה בשלב ראשון".** זה הסדר כאן ממש: מפתח
 * החברה מצמצם, והכותרת מכריעה. שתי רמות, ולא אחת:
 *
 * 1. אותה חברה **ואותה כותרת** היא אותה משרה. מסומנת "כבר הגשת".
 * 2. אותה חברה **וכותרת אחרת** היא ידיעה ולא מסקנה: הגשת לשם, לתפקיד
 *    אחר. היא מוצגת כמידע, ולא כסימון הגשה, כי הגשה ל-NVIDIA בספטמבר
 *    אינה הגשה לכל משרה ב-NVIDIA.
 *
 * **הסימון הוא לקריאה בלבד.** "ללא אפשרות לעריכה רק לידיעתי": הוא לא
 * כפתור, אי אפשר לבטל אותו, והוא לא כותב כלום למסד. ההגשה האמיתית נשארת
 * מה שהוא סימן ידנית על השורה שהוא באמת הגיש ממנה.
 *
 * **והשורה לא מוסתרת.** הוא ביקש במפורש לראות אותה מסומנת ולא להעלים
 * אותה, בשונה מכפילות הרדאר. מודעה באותו שם בחברה גדולה יכולה להיות
 * משרה אחרת, וההחלטה הזאת שלו.
 */

export type AppliedJoinRow = {
  job_id?: string | null;
  sent_at?: string | null;
  jobs?: { title?: string | null; company?: string | null } | null;
};

export type PriorApplication = {
  /** אותה חברה ואותה כותרת, כלומר אותה משרה */
  exact: boolean;
  /** מתי הוגשה, ISO */
  when: string | null;
  /** הכותרת שהוגשה בפועל. אצל התאמת חברה זה מה שמסביר למה זה מוצג */
  title: string;
};

export type PriorIndex = {
  ids: Set<string>;
  byPosting: Map<string, PriorApplication>;
  byCompany: Map<string, PriorApplication>;
};

export const emptyPriorIndex: PriorIndex = {
  ids: new Set(),
  byPosting: new Map(),
  byCompany: new Map(),
};

// המאוחרת ביותר מנצחת. אם הגיש לאותה חברה שלוש פעמים, התאריך שמעניין
// אותו הוא האחרון, לא הראשון.
function keepLatest(
  map: Map<string, PriorApplication>,
  key: string,
  row: PriorApplication
) {
  const had = map.get(key);
  if (!had) {
    map.set(key, row);
    return;
  }
  const a = had.when ?? '';
  const b = row.when ?? '';
  if (b > a) map.set(key, row);
}

export function buildPriorIndex(rows: AppliedJoinRow[] | null | undefined): PriorIndex {
  const idx: PriorIndex = {
    ids: new Set<string>(),
    byPosting: new Map<string, PriorApplication>(),
    byCompany: new Map<string, PriorApplication>(),
  };
  for (const r of rows ?? []) {
    if (r.job_id) idx.ids.add(r.job_id);
    const company = r.jobs?.company ?? '';
    const title = r.jobs?.title ?? '';
    // בלי שם חברה אין התאמה: שלב ראשון הוא החברה, וכותרת לבדה הייתה
    // מצמידה "Project Manager" בחברה אחת ל"Project Manager" בחברה אחרת.
    const ck = companyKey(company);
    if (!ck) continue;
    const hit: PriorApplication = { exact: true, when: r.sent_at ?? null, title };
    keepLatest(idx.byPosting, postingKey(company, title), hit);
    keepLatest(idx.byCompany, ck, { ...hit, exact: false });
  }
  return idx;
}

/**
 * שליפת ההגשות פעם אחת, עם נפילה לאחור.
 *
 * ה-join אל `jobs` הוא PostgREST ולא SQL, ו-tsc לא בודק אותו. אם הוא
 * ייכשל, `data` חוזר ריק **בלי חריגה**, ואז `appliedIds` ריקה וכל ההגשות
 * חוזרות לרשימת הלידים. זאת בדיוק המלכודת השקטה שהפילה כאן דברים לאורך
 * כל 2026, ולכן יש כאן נפילה לאחור לשליפה הפשוטה: במקרה הגרוע הסימון
 * החדש לא מופיע, אבל שום דבר קיים לא נשבר.
 */
export async function loadApplied(sb: any): Promise<{
  rows: AppliedJoinRow[];
  idx: PriorIndex;
  degraded: boolean;
}> {
  const full = await sb.from('applications').select('job_id, sent_at, jobs(title, company)');
  if (!full.error && full.data) {
    return { rows: full.data as AppliedJoinRow[], idx: buildPriorIndex(full.data), degraded: false };
  }
  const bare = await sb.from('applications').select('job_id, sent_at');
  return {
    rows: (bare.data ?? []) as AppliedJoinRow[],
    idx: emptyPriorIndex,
    degraded: true,
  };
}

export function priorApplication(
  idx: PriorIndex,
  job: { id?: string | null; company?: string | null; title?: string | null }
): PriorApplication | null {
  // השורה שהוא עצמו סימן אינה "הגשה קודמת" אלא ההגשה. המסכים מסננים
  // אותה ממילא, וזאת רשת ביטחון למסך שלא יסנן.
  if (job.id && idx.ids.has(job.id)) return null;
  const ck = companyKey(job.company);
  if (!ck) return null;
  const exact = idx.byPosting.get(postingKey(job.company, job.title));
  if (exact) return exact;
  return idx.byCompany.get(ck) ?? null;
}
