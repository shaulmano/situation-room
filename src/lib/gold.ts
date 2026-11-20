import { englishCompany, isRecruiter, referralMessage } from '@/lib/outreach';
import { firstName } from '@/lib/wideReach';

/** כמה חברות ביום. שאול, 20.11.2026: "טופ 30 עד 40". */
export const GOLD_DAILY = 40;

const SIZE_ORDER: Record<string, number> = { E: 0, M: 1, S: 2 };

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
 * סדר החברות: מי שיש בה הכי הרבה מכרים קודם, אחריה גוש דן, אחריה גודל.
 * הצעד הראשון הוא רק מכרים. חברה בלי מכר אינה נכנסת לכאן בשלב הזה.
 */
export function goldOrder(a: { c: GoldCompany; n: number }, b: { c: GoldCompany; n: number }): number {
  if (b.n !== a.n) return b.n - a.n;
  const ra = a.c.region === 'gush_dan' ? 0 : 1;
  const rb = b.c.region === 'gush_dan' ? 0 : 1;
  if (ra !== rb) return ra - rb;
  const sa = SIZE_ORDER[a.c.size_class ?? ''] ?? 3;
  const sb = SIZE_ORDER[b.c.size_class ?? ''] ?? 3;
  if (sa !== sb) return sa - sb;
  return a.c.name.localeCompare(b.c.name);
}

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
