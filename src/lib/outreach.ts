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
  // 13.11.2026, שאול: "Project and release מחליף את Delivery".
  delivery: 'Shaul_Mano_Project_Release_Manager.pdf',
  release: 'Shaul_Mano_Release_Manager.pdf',
  'project-release-manager': 'Shaul_Mano_Project_Release_Manager.pdf',
};

export function cvFileName(cvId?: string | null): string {
  return FILE_NAME[cvId ?? ''] ?? FILE_NAME.qa;
}

// כתובת המודעה, בצורה שאפשר לשלוח.
//
// 13.11.2026. לוחות ישראליים מקודדים את הכותרת בעברית לתוך הכתובת,
// והתוצאה היא עשר שורות של %D7%9E%D7%A0. שאול ראה את זה בהודעה
// שהמתינה לשליחה: "אתה צוחק עלי? כזה מייל אתה רוצה שאשלח?"
//
// בלינקדאין יש צורה קנונית קצרה: המזהה המספרי בסוף הכתובת מספיק,
// והיא נפתחת בדיוק לאותה מודעה. בלוחות אחרים מפענחים את הקידוד, מה
// שמחזיר עברית קריאה במקום סימנים.
export function cleanJobUrl(url?: string | null): string {
  const raw = (url ?? '').trim();
  if (!raw) return '';
  const li = raw.match(/linkedin\.com\/jobs\/view\/(?:.*?-)?(\d{6,})/);
  if (li) return `https://www.linkedin.com/jobs/view/${li[1]}`;
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.length < raw.length) return decoded;
  } catch {
    // כתובת עם קידוד שבור נשארת כמו שהיא.
  }
  return raw;
}

// שם החברה באנגלית.
//
// 13.11.2026. לוחות ישראליים מפרסמים שם דו לשוני: "Clal Insurance &
// Finance- כלל ביטוח ופיננסים", או "מרטנס | Mertens - מקבוצת מלם תים".
// בתוך הודעה באנגלית זה נראה שבור.
//
// ניקוי חד פעמי במסד כבר נוסה באותו יום, והסריקה הבאה כתבה מעליו את
// השם המקורי. לכן הניקוי קורה כאן, בכל בנייה של הודעה, ולא בנתונים.
//
// מחלקים לפי מפרידים ובוחרים את הקטע עם הכי הרבה אותיות לטיניות.
// חברה ששמה עברי בלבד נשארת כמו שהיא: תרגום שלה הוא ניחוש, ושם חברה
// שגוי גרוע משם בעברית.
export function englishCompany(name?: string | null): string {
  const raw = (name ?? '').trim();
  if (!raw || !/[A-Za-z]/.test(raw)) return raw;
  const parts = raw.split(/\s*[|\u2013\u2014\u00b7/]\s*|\s+-\s+|-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return raw;
  const latin = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length;
  const best = parts.reduce((a, b) => (latin(b) > latin(a) ? b : a));
  return latin(best) ? best : raw;
}

// כותרת המשרה באנגלית.
//
// 13.11.2026, שאול: "הכל צריך להיות באנגלית, אם אתה מזהה עברית פשוט
// תתרגם לאנגלית". הפנייה לרייצ'ל בכלל יצאה עם "I'm attaching my CV for
// the מנהל.ת פרויקטים ארגון ושיטות position", עברית בתוך משפט באנגלית.
//
// שלושה מקורות, לפי סדר אמינות, ולא ניחוש:
//   1. הכותרת עצמה, כשהיא כבר לטינית.
//   2. foundFor, שם התפקיד באנגלית שבו המשרה נמצאה בחיפוש. זה המידע
//      הכי אמין שיש: זה בדיוק מה שהמערכת חיפשה כשהיא מצאה אותה.
//   3. טבלת ביטויים לכותרות שחוזרות בלוחות הישראליים.
// ואם כל אלה נכשלו, שם משפחת התפקידים לפי גרסת קורות החיים.
const HE = /[\u0590-\u05FF]/;

const HE_TITLE: Array<[RegExp, string]> = [
  [/ארגון\s*ו?שיטות/, 'Organization and Methods'],
  [/אבטחת\s*איכות/, 'QA'],
  [/בקרת\s*איכות/, 'Quality Control'],
  [/ראש\s*צוות/, 'Team Lead'],
  [/מנהל[\/.]?ת?\s*צוות/, 'Team Lead'],
  [/מנהל[\/.]?ת?\s*תוכני(ו?ת|ה)/, 'Program Manager'],
  [/מנהל[\/.]?ת?\s*פרויקטים/, 'Project Manager'],
  [/מנהל[\/.]?ת?\s*פרויקט/, 'Project Manager'],
  [/מנהל[\/.]?ת?\s*איכות/, 'Quality Manager'],
  [/מנהל[\/.]?ת?\s*שחרור(ים)?/, 'Release Manager'],
  [/מנהל[\/.]?ת?\s*תפעול/, 'Operations Manager'],
  [/מנהל[\/.]?ת?\s*פיתוח/, 'Development Manager'],
  [/מנהל[\/.]?ת?\s*מוצר/, 'Product Manager'],
];

const FAMILY: Record<string, string> = {
  qa: 'QA Manager',
  program: 'Project Manager',
  delivery: 'Delivery Manager',
  release: 'Release Manager',
  'project-release-manager': 'Project and Release Manager',
};

export function englishTitle(opts: {
  jobTitle: string;
  foundFor?: string | null;
  cvId?: string | null;
}): string {
  const raw = shortTitle(opts.jobTitle ?? '');
  if (raw && !HE.test(raw)) return raw;

  const found = (opts.foundFor ?? '').trim();
  if (found && !HE.test(found)) return found;

  for (const [re, en] of HE_TITLE) {
    if (re.test(opts.jobTitle ?? '')) {
      // "מנהל פרויקטים ארגון ושיטות" הוא שני ביטויים, ומחברים אותם
      // בסדר האנגלי: התחום ואחריו התפקיד.
      const domain = HE_TITLE.find(
        ([r, e]) => e !== en && r.test(opts.jobTitle ?? '') && !e.includes('Manager') && !e.includes('Lead'),
      );
      return domain ? `${domain[1]} ${en}` : en;
    }
  }
  return FAMILY[opts.cvId ?? ''] ?? FAMILY.qa;
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
  // שם התפקיד באנגלית שבו המשרה נמצאה בחיפוש.
  foundFor?: string | null;
  // הקישור למודעה עצמה.
  jobUrl?: string | null;
  attached?: boolean;
  /** המשרה כבר הוגשה. מוסיף את העובדה הזאת, כי היא הקרס החזק ביותר. */
  applied?: boolean;
  /** חברת השמה. שם אין "פנימית": הם המגייסים, ולא עובדים אצל המעסיק. */
  agency?: boolean;
}): string {
  // 12.11.2026, שאול הכתיב את המבנה מילה במילה: "הי שם, ראיתי שאתה
  // עובד בחברת שם החברה, אני מצרף את הקורות חיים שלי למשרת שם המשרה
  // ואשמח באם תוכל להעביר אותם פנימית למגייסים הרלוונטיים. המון תודה,
  // שאול."
  //
  // 13.11.2026: המשפט השלישי משתנה כשאיש הקשר הוא עצמו מגייס. אותו
  // מבנה, אותה פתיחה ואותה סגירה, רק הבקשה מתאימה למי שקורא אותה.
  const title = englishTitle(opts);
  const company = englishCompany(opts.company);
  // 13.11.2026. שאול הגיש ל-Aidoc, בלוק המכרים נעלם, והוא שאל "למה זה
  // לא מופיע במכרים?". משרה שהוגשה הוסרה משני המסכים, וזה היה הפוך
  // מהכוונה: מועמדות שכבר בתוך המערכת היא בדיוק מה שמכר יכול להרים.
  // בלי המשפט הזה הוא לא יודע שיש מה להרים.
  // 14.11.2026. שאול הצביע על SQLink: עשרה אנשי קשר, תשעה מהם מגייסים של
  // חברת ההשמה עצמה, וההודעה ביקשה מהם "להעביר פנימית למגייסים
  // הרלוונטיים". הם המגייסים הרלוונטיים, ואין אצלם "פנימית": הם לא
  // עובדים אצל המעסיק אלא מאיישים אצלו.
  const ask = opts.agency
    ? (opts.applied
        ? `I applied to the ${title} position you posted. I'm attaching my CV, and I would be glad to talk about whether it's a fit.`
        // בלי "I saw" פעמיים ברצף: השורה שמעל כבר פותחת ב-"I saw that you
        // work at". שתי אותן שתי מילים בשתי שורות עוקבות נקראות כמו תבנית.
        : `I'm interested in the ${title} position you're advertising. I'm attaching my CV, and I would be glad to talk about whether it's a fit.`)
    : opts.applied
    ? (isRecruiter(opts.contactTitle)
        ? `I applied to the ${title} position and I'm attaching my CV, so you have it directly.`
        : `I applied to the ${title} position, and I'm attaching my CV in case you can pass it on internally to the relevant recruiters.`)
    : (isRecruiter(opts.contactTitle)
        ? `I'm attaching my CV for the ${title} position, and I would be glad if you could take a look.`
        : `I'm attaching my CV for the ${title} position, and I would be glad if you could pass it on internally to the relevant recruiters.`);
  // 13.11.2026: הקישור למודעה. שלושת האנשים הראשונים שענו שאלו את אותה
  // שאלה בדיוק, "על איזו משרה", ואחד מהם כתב במפורש "if you can attach
  // the specific role you are interested in that will help". שם התפקיד
  // לבדו לא הספיק להם: בחברה גדולה יש כמה משרות דומות, והם צריכים
  // לדעת על איזו מודעה להעביר את הקובץ.
  //
  // בשורה נפרדת ולא בתוך המשפט, כדי שאפשר יהיה להעתיק אותה או ללחוץ
  // עליה בלי לקרוא את כל ההודעה.
  const lines = [
    `Hi ${firstName(opts.contactName)},`,
    `I saw that you work at ${company}.`,
    ask,
  ];
  const link = cleanJobUrl(opts.jobUrl);
  if (link) lines.push('', `The role: ${link}`);
  lines.push('', 'Thanks a lot,', 'Shaul');
  return lines.join('\n');
}

// ── פנייה למי שפרסם את המודעה ────────────────────────────────────────────────
//
// 13.11.2026, שאול: "על כל שליחה למשרה בלינקדאין אתה תמצא לי את המפרסם
// ותכניס אותי לשליחת הודעה פרטית".
//
// שתי הודעות שונות, ולא אחת, כי לינקדאין מתנהגת אחרת בכל מקרה: למי שאתה
// מחובר אליו אפשר לשלוח הודעה עם קובץ מצורף, ולמי שלא אפשר רק פתק בבקשת
// חברות, בלי קובץ ובמגבלת 200 תווים.

/** משווה שתי כתובות פרופיל: il.linkedin.com ו-www.linkedin.com הם אותו אדם. */
export function sameProfile(a?: string | null, b?: string | null): boolean {
  const norm = (u?: string | null) => (u ?? '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^[a-z]{2}\./, '')
    .replace(/^www\./, '')
    .split('?')[0]
    .replace(/\/+$/, '');
  const x = norm(a);
  return !!x && x === norm(b);
}

/** פתק בבקשת חברות. לינקדאין חותכת ב-200 תווים, ואין אפשרות לצרף קובץ. */
export function posterNote(opts: {
  contactName: string;
  company: string;
  jobTitle: string;
  foundFor?: string | null;
  cvId?: string | null;
}): string {
  const title = englishTitle(opts);
  const company = englishCompany(opts.company);
  // בלי בקשה ובלי קובץ: הפתק הזה קונה רק את החיבור. הבקשה עצמה נשלחת
  // בהודעה שאחריו, וכך היא לא נחתכת באמצע ולא נקראת כנדנוד.
  const note = `Hi ${firstName(opts.contactName)}, I applied to the ${title} role you posted at ${company}. Connecting so I can share my background with you directly. Thanks, Shaul`;
  return note.length <= 200 ? note
    : `Hi ${firstName(opts.contactName)}, I applied to the ${title} role you posted. Connecting so I can share my background directly. Thanks, Shaul`.slice(0, 200);
}

/** הודעה מלאה, למי ששאול כבר מחובר אליו. כאן אפשר לצרף את הקובץ. */
export function posterMessage(opts: {
  contactName: string;
  company: string;
  jobTitle: string;
  foundFor?: string | null;
  cvId?: string | null;
  jobUrl?: string | null;
  /** משרות נוספות של אותו מפרסם שהוגש אליהן. */
  alsoTitles?: string[];
}): string {
  const title = englishTitle(opts);
  const company = englishCompany(opts.company);
  const lines = [
    `Hi ${firstName(opts.contactName)},`,
    `I saw that you posted the ${title} position at ${company}, and I applied to it today.`,
    // הבקשה למפרסם היא להסתכל, לא להעביר הלאה: הוא זה שמחזיק את המשרה.
    `I'm attaching my CV, and I would be glad if you could take a look.`,
  ];
  // אותו אדם פרסם כמה משרות שהוגש אליהן. הודעה אחת שמזכירה את כולן, ולא
  // שתי הודעות לאותו אדם באותו יום.
  // דרך אותו ניקוי: בלעדיו ההודעה אמרה "Senior Project Manager" בשורה
  // אחת ו-"Technology Project Manager (38055)" בשורה אחרת, כלומר מספר
  // דרישה פנימי של החברה בתוך הודעה אישית.
  const also = (opts.alsoTitles ?? [])
    .filter(Boolean)
    .map((t) => englishTitle({ jobTitle: t }));
  if (also.length) {
    lines.push('', `I also applied to ${also.join(' and ')}, if either is a better fit.`);
  }
  const link = cleanJobUrl(opts.jobUrl);
  if (link) lines.push('', `The role: ${link}`);
  lines.push('', 'Thanks a lot,', 'Shaul');
  return lines.join('\n');
}
