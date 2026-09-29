// The referral message, assembled per job so that nothing has to be written
// from scratch. Shaul messages people he already knows, on LinkedIn, and asks
// them to refer him internally. Three short lines, in English: the names, the
// companies and the job titles are all English anyway, and a Hebrew sentence
// with an English title glued into it reads worse than either language alone.
//
// The CV lives in a public Supabase Storage bucket, one file per job family,
// named after the same cv_id the matcher already assigns. No attachment is
// possible inside a LinkedIn message written from here, and a link forwards
// better anyway when someone passes it to their recruiter.
const CV_FILE: Record<string, string> = {
  qa: 'Shaul_Mano_QA_Manager.pdf',
  program: 'Shaul_Mano_Program_Manager.pdf',
  delivery: 'Shaul_Mano_Delivery_Manager.pdf',
};

const PITCH: Record<string, string> = {
  qa: '15 years leading QA in enterprise SaaS, most recently as Head of QA at Qmarkets',
  program: '15 years leading program and release management in enterprise SaaS, most recently at Qmarkets',
  delivery: '15 years leading delivery and professional services in enterprise SaaS, most recently at Qmarkets',
};

export function cvUrl(cvId?: string | null): string {
  const file = CV_FILE[cvId ?? ''] ?? CV_FILE.qa;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/cv/${file}`;
}

// First name only. "Hi Yotam Cohen" reads like a form letter, which is the one
// thing this message cannot afford.
function firstName(full: string): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}

// Boards publish titles like "Technical Program Manager Silicon Design
// Services and Strategic Extended Workforce". A whole line of corporate
// wording inside a three-line message buries the ask, so the title is cut at
// the first comma or bracket and capped at six words.
function shortTitle(title: string): string {
  const head = (title ?? '').split(/[,|(\u2013\u2014-]/)[0].trim();
  const words = head.split(/\s+/).filter(Boolean);
  return words.length > 6 ? words.slice(0, 6).join(' ') : head;
}

export function referralMessage(opts: {
  contactName: string;
  company: string;
  jobTitle: string;
  cvId?: string | null;
}): string {
  const pitch = PITCH[opts.cvId ?? ''] ?? PITCH.qa;
  return [
    `Hi ${firstName(opts.contactName)}, hope you are doing well.`,
    `I noticed ${opts.company} is hiring a ${shortTitle(opts.jobTitle)}. It is a close fit for my background: ${pitch}.`,
    `Would you be open to referring me internally? My CV: ${cvUrl(opts.cvId)}`,
  ].join('\n');
}
