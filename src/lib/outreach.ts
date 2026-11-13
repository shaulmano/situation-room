// The referral message, assembled per job so that nothing has to be written
// from scratch. Shaul messages people he already knows, on LinkedIn or by
// email, and asks them to refer him internally. In English: the names, the
// companies and the job titles are all English anyway, and a Hebrew sentence
// with an English title glued into it reads worse than either language alone.
//
// 13.11.2026: the public Supabase bucket and cvUrl were removed. They pointed
// at three files uploaded on 29.9, six weeks before the versions were updated,
// and the two newest versions had no file there at all, so a Release Manager
// referral would have linked to the QA CV. The CV is attached now, from the
// row in cvs, and the only link in this file is gone.
//
// שם הקובץ שיש לשאול אצלו, בטלפון ובמחשב, לכל משפחת תפקידים.
//
// 13.11.2026, שאול: "את כל הקבצים יש לי גם בטלפון וגם במחשב, אתה לא
// צריך לשים כלום, אולי על כל מייל או הודעה לכתוב לי איזה קובץ לצרף
// בדיוק כמו שאנחנו עושים עם פייסבוק". זה מחליף גם את הקישור לדלי וגם
// את הרעיון לשמור את הקבצים במסד.
//
// השמות הם כפי שהקבצים נקראים אצלו. שינוי שם אצלו מחייב שינוי כאן.
const FILE_NAME: Record<string, string> = {
  qa: 'Shaul_Mano_QA_Manager.pdf',
  program: 'Shaul_Mano_Project_Manager.pdf',
  delivery: 'Shaul_Mano_Delivery_Manager.pdf',
  release: 'Shaul_Mano_Release_Manager.pdf',
  'project-release-manager': 'Shaul_Mano_Project_Release_Manager.pdf',
};

export function cvFileName(cvId?: string | null): string {
  return FILE_NAME[cvId ?? ''] ?? FILE_NAME.qa;
}

// מי שהוא עצמו מגייס.
//
// 12.11.2026 בלילה, שאול: "תסביר לי את הקונפליקט שאני מרגיש". מתוך
// ארבע הפניות שהיו בתור, שתיים היו לאנשים שהם עצמם מגייסים, וההודעה
// ביקשה מהם להעביר את קורות החיים למגייסים. זה נשמע כאילו לא טרחת
// לבדוק למי אתה כותב, וזה ההפך ממה שפנייה דרך מכר אמורה להשיג.
//
// למגייסת לא מבקשים להעביר הלאה. היא היעד, ומבקשים ממנה להסתכל.
const RECRUITER_RE = new RegExp(
  [
    'talent acquisition', 'recruit', 'sourcer', 'sourcing',
    'human resources', '\\bhr\\b', 'hrbp', 'people partner',
    'people operations', 'staffing',
    'גיוס', 'מגייס', 'מגייסת', 'משאבי אנוש',
  ].join('|'),
  'i',
);

export function isRecruiter(title?: string | null): boolean {
  return RECRUITER_RE.test(title ?? '');
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
  // התפקיד של איש הקשר עצמו, לא של המשרה. הוא קובע איזו בקשה מתאימה.
  contactTitle?: string | null;
  attached?: boolean;
}): string {
  // 12.11.2026, שאול הכתיב את המבנה מילה במילה: "הי שם, ראיתי שאתה
  // עובד בחברת שם החברה, אני מצרף את הקורות חיים שלי למשרת שם המשרה
  // ואשמח באם תוכל להעביר אותם פנימית למגייסים הרלוונטיים. המון תודה,
  // שאול."
  //
  // 13.11.2026: המשפט השלישי משתנה כשאיש הקשר הוא עצמו מגייס. אותו
  // מבנה, אותה פתיחה ואותה סגירה, רק הבקשה מתאימה למי שקורא אותה.
  const title = shortTitle(opts.jobTitle);
  const ask = isRecruiter(opts.contactTitle)
    ? `I'm attaching my CV for the ${title} position, and I would be glad if you could take a look.`
    : `I'm attaching my CV for the ${title} position, and I would be glad if you could pass it on internally to the relevant recruiters.`;
  return [
    `Hi ${firstName(opts.contactName)},`,
    `I saw that you work at ${opts.company}.`,
    ask,
    '',
    'Thanks a lot,',
    'Shaul',
  ].join('\n');
}
