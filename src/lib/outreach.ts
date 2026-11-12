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
  // 12.11.2026: שתי גרסאות חדשות. בלעדיהן הן נפלו לברירת המחדל, qa,
  // ופנייה על משרת Release Manager הציגה אותו כמנהל QA.
  release: 'Shaul_Mano_Release_Manager.pdf',
  'project-release-manager': 'Shaul_Mano_Project_Release_Manager.pdf',
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
  // 12.11.2026: במייל קורות החיים מצורפים כקובץ, ושאול ביקש קובץ פיזי ולא
  // קישור. בלינקדאין אי אפשר לצרף קובץ מהודעה שנכתבת כאן, ולכן שם נשאר
  // הקישור.
  attached?: boolean;
}): string {
  // 12.11.2026, שאול הכתיב את המבנה מילה במילה אחרי שקרא את הנוסח הקודם:
  // "הי שם, ראיתי שאתה עובד בחברת שם החברה, אני מצרף את הקורות חיים שלי
  // למשרת שם המשרה ואשמח באם תוכל להעביר אותם פנימית למגייסים הרלוונטיים.
  // המון תודה, שאול."
  //
  // מה שירד: המשפט "I have spent the last 15 years". זה פתיח של קורות
  // חיים ולא של הודעה בין שני אנשים שמכירים, והוא מה שגרם לנוסח הקודם
  // להישמע כמו פנייה קרה. הקורות חיים מצורפים ממילא, ומי שיפתח אותם יראה
  // שם את הניסיון. לכן גם המפה PITCH נמחקה ולא הוחלפה.
  //
  // ללא קו מפריד ארוך ובלי ניסוח שנשמע כמו טקסט שנכתב במכונה.
  const title = shortTitle(opts.jobTitle);
  const cv = opts.attached
    ? "I'm attaching my CV for the " + title + ' position'
    : "I'm sending my CV for the " + title + ' position: ' + cvUrl(opts.cvId);
  return [
    `Hi ${firstName(opts.contactName)},`,
    `I saw that you work at ${opts.company}.`,
    `${cv}, and I would be glad if you could pass it on internally to the relevant recruiters.`,
    '',
    'Thanks a lot,',
    'Shaul',
  ].join('\n');
}
