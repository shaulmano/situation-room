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
  skipped_at?: string | null;
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

/**
 * חיפוש אנשים בחברה מסוימת, בלינקדאין עצמה.
 *
 * 14.11.2026. שאול, אחרי ששלומי בלינקו ענה שהוא עזב: "אולי אתה יכול
 * להביא אנשי קשר אחרים במקומו באותה חברה כהמלצה אלי, איש קשר שעובד שם
 * והוא לא חבר, ואז לבקש חברות".
 *
 * **קישור ולא גריפה.** הכלל שלו עצמו, מ-12.11: "קשרים מדרגה שנייה לא
 * נגרדים מלינקדאין: רק קישור לחיפוש של לינקדאין עצמה". אנשים שלא הסכימו
 * להיקטלג לא נכנסים למסד, והחיפוש נפתח אצלו בדפדפן עם הסינון מוכן.
 * network=S הוא דרגה שנייה, כלומר בדיוק מי שאפשר לשלוח לו בקשת חברות.
 */
export function peopleAtCompanyHref(company?: string | null, role?: string | null): string | null {
  const name = (company ?? '').trim();
  if (!name) return null;
  const words = [name, (role ?? '').trim()].filter(Boolean).join(' ');
  return 'https://www.linkedin.com/search/results/people/?network=%5B%22S%22%5D&keywords='
    + encodeURIComponent(words);
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
