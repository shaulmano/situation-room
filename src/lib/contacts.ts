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
