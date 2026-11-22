import { englishCompany, isRecruiter, referralMessage } from '@/lib/outreach';
import { firstName } from '@/lib/wideReach';

/**
 * כמה חברות ביום, ובאיזה תמהיל. 20.11.2026, שאול: "50 חברות מכל הסוגים,
 * וכולם בלי יוצא מהכלל. ה-50 יהיו מיקס של כל הגדלים."
 * S עד 50 עובדים, M 51 עד 200, E מעל 200.
 */
export const GOLD_QUOTA: Record<string, number> = { S: 20, M: 15, E: 15 };
export const GOLD_DAILY = 50;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * סדר בתוך גודל: מי שיש בה מכרים קודם (הכי הרבה קודם), אחריה גוש דן,
 * ואחר כך סדר שמתחלף כל יום, כדי שכל החברות ייגמרו בלי שהכי גדולה
 * בשמה תחכה לנצח. הסדר יציב לאורך היום, ולכן שורה שנסגרה לא מערבבת
 * את השאר.
 */
export function goldRank(
  a: { id: string; n: number; gush: boolean },
  b: { id: string; n: number; gush: boolean },
  day: string,
): number {
  if (b.n !== a.n) return b.n - a.n;
  if (a.gush !== b.gush) return a.gush ? -1 : 1;
  return hash(day + a.id) - hash(day + b.id);
}

export type GoldCompany = {
  id: string;
  name: string;
  company_key: string;
  size_class: string | null;
  size_range: string | null;
  region: string | null;
  city: string | null;
  website: string | null;
  careers_url: string | null;
  is_hiring: boolean;
};

/**
 * הודעה לאיש קשר בחברה. יש משרה פתוחה: אותו נוסח של הפניות דרך מכרים.
 * אין: הודעה כללית עם קורות החיים, באותו מבנה ובלי להמציא משרה.
 */
export function goldMessage(opts: {
  contactName: string;
  contactTitle?: string | null;
  company: string;
  job?: { title: string; url: string | null; foundFor: string | null } | null;
  cvId?: string | null;
}): string {
  if (opts.job) {
    return referralMessage({
      contactName: opts.contactName,
      company: opts.company,
      jobTitle: opts.job.title,
      cvId: opts.cvId,
      contactTitle: opts.contactTitle,
      foundFor: opts.job.foundFor,
      jobUrl: opts.job.url,
    });
  }
  const ask = isRecruiter(opts.contactTitle)
    ? "I'm looking for my next role as a Senior Program Manager / QA Leader, and I'm attaching my CV. I would be glad if you could take a look and let me know whether anything relevant is open."
    : "I'm looking for my next role as a Senior Program Manager / QA Leader, and I'm attaching my CV. I would be glad if you could tell me whether anything relevant is open, or pass it on internally to the relevant recruiters.";
  return [
    `Hi ${firstName(opts.contactName)},`,
    `I saw that you work at ${englishCompany(opts.company)}.`,
    ask,
    '',
    'Thanks a lot,',
    'Shaul',
  ].join('\n');
}

/**
 * אותה הודעה של אנשי הקשר, בלי שם, למגייס/ת שאינם ברשימה. שאול (21.11.2026):
 * "תכין לי את אותה הודעה גנרית להעתקה ואני אפנה ידנית".
 */
export function goldGenericMessage(company: string, job: { title: string; url: string | null; foundFor: string | null } | null, cvId?: string | null): string {
  return goldMessage({ contactName: '', contactTitle: 'Recruiter', company, job, cvId }).replace(/^Hi ,/, 'Hi,');
}

/**
 * כינויי חברה (company_aliases): שם כפי שנראה באיש קשר או במשרה, ומפתח החברה
 * במאגר. ההצלבה המדויקת קודמת תמיד, והכינוי רק משלים. טבלה ריקה: אין שינוי.
 */
export async function loadAliases(sb: any): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('company_aliases').select('alias_key, company_key').order('alias_key').range(from, from + 999);
    if (error || !data) break;
    for (const r of data as any[]) out.set(r.alias_key, r.company_key);
    if (data.length < 1000) break;
  }
  return out;
}

/**
 * אילו מפתחות חברה מבין הנתונים הם חברות זהב (גוש דן, במאגר). משמש את
 * מסך הבית ומסך המשרות כדי לסמן משרה שמופיעה גם שם. 20.11.2026, שאול:
 * "כל משרה שמופיעה גם בתוצאות סריקה וגם במשרת זהב תסומן".
 * מחזיר את המפתחות **כפי שנשלחו**, גם אם ההתאמה הייתה דרך כינוי.
 */
export async function goldKeySet(sb: any, keys: string[]): Promise<Set<string>> {
  const uniq = [...new Set(keys.filter(Boolean))];
  const aliases = await loadAliases(sb);
  const resolved = new Map<string, string[]>();
  for (const k of uniq) {
    const r = aliases.get(k) ?? k;
    resolved.set(r, [...(resolved.get(r) ?? []), k]);
  }
  const rk = [...resolved.keys()];
  const out = new Set<string>();
  for (let i = 0; i < rk.length; i += 100) {
    const { data } = await sb.from('companies').select('company_key')
      .eq('region', 'gush_dan').in('company_key', rk.slice(i, i + 100));
    for (const r of (data ?? []) as any[]) for (const k of resolved.get(r.company_key) ?? []) out.add(k);
  }
  return out;
}


/**
 * הערה לבקשת חברות למגייס שאינו קשר של שאול (נמצא בחיפוש, ראה
 * gold_recruiters). לינקדאין מגבילה הערה ל-300 תווים, ואי אפשר לצרף בה
 * קובץ. הקובץ נשלח אחרי שהוא מאשר, במסך "אישר חברות".
 */
export function goldConnectNote(opts: { name: string; company: string; jobTitle?: string | null }): string {
  const hi = `Hi ${firstName(opts.name) || 'there'},`;
  const co = englishCompany(opts.company);
  const body = opts.jobTitle
    ? `I saw that ${co} is hiring a ${opts.jobTitle}. I'm a Program / QA leader with 15+ years in high-tech, and I would be glad to connect and send you my CV.`
    : `I'm a Program / QA leader with 15+ years in high-tech, looking for my next role. I would be glad to connect and send you my CV.`;
  const note = `${hi} ${body} Thanks, Shaul`;
  return note.length <= 295 ? note : `${hi} I'm a Program / QA leader with 15+ years in high-tech and would be glad to connect and send you my CV. Thanks, Shaul`;
}
