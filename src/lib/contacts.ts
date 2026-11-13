// Company names arrive from twelve job boards on one side and from a LinkedIn
// export on the other, and they never agree on punctuation: "Qmarkets",
// "Qmarkets Ltd.", "QMARKETS". Both sides are reduced to the same key, once,
// here, contacts.company_key is written with this function at import time and
// the job screens look up with it, so there is exactly one definition.
const LEGAL_SUFFIX = /(ltd|limited|inc|incorporated|llc|corp|corporation|gmbh|בעמ)$/;

export function companyKey(name?: string | null): string {
  const flat = (name ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return flat.replace(LEGAL_SUFFIX, '');
}

export type WarmContact = {
  id: string;
  full_name: string;
  title: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  replied_at?: string | null;
  contacted_at: string | null;
};

// Second-degree connections are not in any export and not in any API: they
// exist only inside LinkedIn, behind a login. So the app does not pretend to
// know them. This opens the real "connections of" search on that person's
// profile, where LinkedIn shows who they know, with no scraping at all.
export function mutualsHref(linkedinUrl?: string | null): string | null {
  const handle = (linkedinUrl ?? '').match(/\/in\/([^/?#]+)/);
  if (!handle) return null;
  return (
    'https://www.linkedin.com/search/results/people/?facetConnectionOf=' +
    encodeURIComponent(handle[1])
  );
}

// שליפת אנשי קשר לפי מפתחות חברה, במנות.
//
// 12.11.2026. הקוד הקודם עשה או `in` עם כל המפתחות, או, כשהיו יותר
// מ-120, משך את כל טבלת אנשי הקשר, 5,000 שורות, בכל טעינת מסך. שלושה
// מסכים עשו את זה, בלי מטמון, בכל רענון. זה היה אחד משלושת הדברים
// שכילו את תקציב ה-Disk IO של הפרויקט באותו יום.
//
// מנה של 100 מפתחות נכנסת בנוחות לאורך כתובת, ושלוש מנות הן שלוש
// שאילתות קטנות עם אינדקס, במקום סריקה של טבלה שלמה.
export async function contactsByCompanyKeys(
  sb: any,
  keys: string[],
  select: string,
): Promise<any[]> {
  const clean = [...new Set(keys.filter(Boolean))];
  if (!clean.length) return [];
  const CHUNK = 100;
  const out: any[] = [];
  for (let i = 0; i < clean.length; i += CHUNK) {
    const { data } = await sb
      .from('contacts')
      .select(select)
      .in('company_key', clean.slice(i, i + CHUNK));
    if (data) out.push(...data);
  }
  return out;
}
