// The referral message, assembled per job so that nothing has to be written
// from scratch. Shaul messages people he already knows, on LinkedIn, and asks
// them to refer him internally. Three short lines: long messages there do not
// get read.
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
  qa: 'זה בול התחום שלי, 15 שנה בניהול QA בסאס ארגוני.',
  program: 'זה בול התחום שלי, 15 שנה בניהול תוכניות וגרסאות בסאס ארגוני.',
  delivery: 'זה בול התחום שלי, 15 שנה בניהול Delivery ושירותים מקצועיים בסאס ארגוני.',
};

export function cvUrl(cvId?: string | null): string {
  const file = CV_FILE[cvId ?? ''] ?? CV_FILE.qa;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/cv/${file}`;
}

// First name only. "היי ישראל ישראלי" reads like a form letter, which is the
// one thing this message cannot afford.
function firstName(full: string): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}

export function referralMessage(opts: {
  contactName: string;
  company: string;
  jobTitle: string;
  cvId?: string | null;
}): string {
  const pitch = PITCH[opts.cvId ?? ''] ?? PITCH.qa;
  return [
    `היי ${firstName(opts.contactName)}, מה שלומך?`,
    `ראיתי ש${opts.company} מגייסת ל${opts.jobTitle}. ${pitch}`,
    `תוכל להפנות אותי פנימית? קורות חיים כאן: ${cvUrl(opts.cvId)}`,
  ].join('\n');
}// The referral message, assembled per job so that nothing has to be written
// from scratch. Shaul messages people he already knows, on LinkedIn, and asks
// them to refer him internally. Three short lines: long messages there do not
// get read.
//
// The CV lives in a public Supabase Storage bucket, one file per job family,
// named after the same cv_id the matcher already assigns. No attachment is
// possible inside a LinkedIn message written from here, and a link forwards
// better anyway when someone passes it to their recruiter.
const CV_FILE: Record<string, string> = {
  qa: 'qa.pdf',
  program: 'program.pdf',
  delivery: 'delivery.pdf',
};

const PITCH: Record<string, string> = {
  qa: 'זה בול התחום שלי, 15 שנה בניהול QA בסאס ארגוני.',
  program: 'זה בול התחום שלי, 15 שנה בניהול תוכניות וגרסאות בסאס ארגוני.',
  delivery: 'זה בול התחום שלי, 15 שנה בניהול Delivery ושירותים מקצועיים בסאס ארגוני.',
};

export function cvUrl(cvId?: string | null): string {
  const file = CV_FILE[cvId ?? ''] ?? CV_FILE.qa;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/cv/${file}`;
}

// First name only. "היי ישראל ישראלי" reads like a form letter, which is the
// one thing this message cannot afford.
function firstName(full: string): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}

export function referralMessage(opts: {
  contactName: string;
  company: string;
  jobTitle: string;
  cvId?: string | null;
}): string {
  const pitch = PITCH[opts.cvId ?? ''] ?? PITCH.qa;
  return [
    `היי ${firstName(opts.contactName)}, מה שלומך?`,
    `ראיתי ש${opts.company} מגייסת ל${opts.jobTitle}. ${pitch}`,
    `תוכל להפנות אותי פנימית? קורות חיים כאן: ${cvUrl(opts.cvId)}`,
  ].join('\n');
}
