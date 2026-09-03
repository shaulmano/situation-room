// SecretJobs is an aggregator behind a paywall: its job pages return 200 with
// the right title, then show a sign-up wall instead of the posting. 188 of its
// rows cleared the gates and none ever became an application, which is what
// that dead end costs.
//
// The company name survives in its slug, so rather than hiding those rows or
// sending Shaul to a paywall, point the button at a LinkedIn search for the
// same title and company — where the posting is actually applyable.
const PAYWALLED = new Set(['SecretJobs']);

export type ApplyTarget = { href: string; label: string; indirect: boolean };

export function applyTarget(job: {
  title?: string | null;
  company?: string | null;
  source?: string | null;
  url?: string | null;
}): ApplyTarget | null {
  const source = job.source ?? '';

  if (PAYWALLED.has(source)) {
    const terms = [job.title, job.company].filter(Boolean).join(' ');
    if (!terms) return null;
    return {
      href: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(terms)}&location=Israel`,
      label: 'חפש',
      indirect: true,
    };
  }

  if (!job.url) return null;
  return { href: job.url, label: 'להגשה', indirect: false };
}
