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
  attached?: boolean;
}): string {
  // 12.11.2026, שאול הכתיב את המבנה מילה במילה אחרי שקרא את הנוסח הקודם:
  // "הי שם, ראיתי שאתה עובד בחברת שם החברה, אני מצרף את הקורות חיים שלי
  // למשרת שם המשרה ואשמח באם תוכל להעביר אותם פנימית למגייסים הרלוונטיים.
  // המון תודה, שאול."
  //
  // 13.11.2026: הקישור ירד גם מהנוסח של לינקדאין. שאול: "אני פוחד שאנשים
  // לא יפתחו אותו". לינקדאין מוריד חשיפה להודעות עם קישור חיצוני, וקישור
  // מצביע על קובץ שיכול להתיישן, מה שקרה בפועל. בלינקדאין שאול מצרף את
  // הקובץ ידנית מהכפתור שבתור, ולכן שתי הגרסאות אומרות attaching.
  const title = shortTitle(opts.jobTitle);
  return [
    `Hi ${firstName(opts.contactName)},`,
    `I saw that you work at ${opts.company}.`,
    `I'm attaching my CV for the ${title} position, and I would be glad if you could pass it on internally to the relevant recruiters.`,
    '',
    'Thanks a lot,',
    'Shaul',
  ].join('\n');
}
