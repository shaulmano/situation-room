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

// Direct channels, 17/09/2026. Easy Apply through LinkedIn produced ~99
// applications and no callbacks, so each lead also gets a way around it: the
// same posting on the company's own careers page or ATS, and the people who
// recruit there. Both are searches built from title and company at render
// time. Nothing about any recruiter is fetched or stored, which keeps the rule
// in sync/jobs_sync.py: real people are not catalogued in this database.
//
// The ATS sources are already the company's own board, so they get neither.
const COMPANY_BOARDS = new Set(['Comeet', 'Greenhouse', 'Ashby', 'SmartRecruiters']);

export function directLinks(job: {
  title?: string | null;
  company?: string | null;
  source?: string | null;
}): ApplyTarget[] {
  const company = (job.company ?? '').trim();
  if (!company || COMPANY_BOARDS.has(job.source ?? '')) return [];
  const title = (job.title ?? '').trim();
  const careers = `"${company}" ${title} (comeet OR greenhouse OR lever OR careers OR jobs)`;
  const people = `${company} (recruiter OR "talent acquisition" OR "HR")`;
  return [
    {
      href: `https://www.google.com/search?q=${encodeURIComponent(careers)}`,
      label: 'אתר החברה',
      indirect: true,
    },
    {
      href: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(people)}`,
      label: 'מגייסים',
      indirect: true,
    },
  ];
}
