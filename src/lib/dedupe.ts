import { companyKey } from '@/lib/contacts';

// The same posting arrives from three boards at once, and closing the two extra
// copies by hand was eleven taps on a seventeen-job day. Two rows are the same
// posting when the company and the title match word for word once case and
// punctuation are taken out.
//
// Location is deliberately not part of the key. The boards write it differently
// for the same job, and a company hiring the same title in two cities is rarer
// than a board writing the city its own way.
export function titleKey(title?: string | null): string {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function postingKey(company?: string | null, title?: string | null): string {
  return `${companyKey(company)}|${titleKey(title)}`;
}

/**
 * חשודות ככפילות: אותה חברה, כותרת קרובה אבל לא זהה.
 *
 * 17.11.2026. שאול: "יש לי הרגשה שמשרות שהיו לפני כמה דקות כבר הוגשו",
 * ואחר כך: "יש לי פתרון וודאי... יהיה כפתור... אני אבדוק בעין ואז אחליט
 * במקום כפולה וודאית כן או לא."
 *
 * **זהות גמורה כבר מטופלת ואינה מגיעה לכאן.** שני המסכים מאחדים שורות
 * לפי `postingKey`, ולכן אותה משרה משני לוחות היא כרטיס אחד מלכתחילה.
 * מה שנשאר גלוי לעין הן הכותרות שנבדלות במילה: "Project Manager" מול
 * "Technical Project Manager" באותה חברה. נמדד באותו בוקר: 129 שורות.
 *
 * **והבדיקה חיה ולא נשמרת.** שאול שאל "מה קורה אם היום היא לא כפולה
 * ומחר כן", וזאת בדיוק הסיבה: שורה שמגיעה מחר מדליקה את השבב על שתיהן
 * בלי שאף אחד יריץ כלום. דגל שנכתב פעם אחת קופא ברגע שנכתב, וזה מה
 * שקרה ל-`manual_dup`, שסימן ב-17.11 ארבע משרות חדשות ככפולות.
 *
 * הסף הוא חפיפת מילים מול הכותרת הקצרה מבין השתיים, ולא מול האיחוד:
 * "Project Manager" בתוך "Technical Project Manager" הוא 2 מתוך 2, וזה
 * מה שאנחנו רוצים לתפוס. מול האיחוד זה היה 2 מתוך 3 ונופל יחד עם
 * מקרים רחוקים הרבה יותר.
 */
const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'for', 'to', 'in', 'at']);

export function titleTokens(title?: string | null): Set<string> {
  return new Set(
    titleKey(title).split(' ').filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

export function titleCloseness(a?: string | null, b?: string | null): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

/** 0.6 ולא 0.5: "QA Manager" מול "QA Director" הוא חצי, והם שני תפקידים. */
const CLOSE_ENOUGH = 0.6;

export type DupCandidate = {
  id: string;
  title: string;
  company: string | null;
  source: string | null;
  location: string | null;
  url: string | null;
  posted: string | null;
  firstSeen: string | null;
  foundFor: string | null;
};

type HasJob = { jobs: any };

/**
 * המועמדות של כרטיס אחד, מתוך כל מה שמוצג על המסך באותו רגע.
 *
 * כותרת **זהה** אינה מוחזרת: היא כבר אוחדה לאותו כרטיס, ולהציג אותה
 * כאן היה אומר לשאול לבדוק דבר שהמערכת כבר הכריעה בו.
 */
export function duplicateCandidates(cards: HasJob[], card: HasJob): DupCandidate[] {
  const j = card.jobs;
  const ck = companyKey(j.company);
  if (!ck) return [];
  const myKey = postingKey(j.company, j.title);

  return cards
    .filter((o) => {
      const t = o.jobs;
      if (!t || t.id === j.id) return false;
      if (companyKey(t.company) !== ck) return false;
      if (postingKey(t.company, t.title) === myKey) return false;
      return titleCloseness(j.title, t.title) >= CLOSE_ENOUGH;
    })
    .map((o) => ({
      id: o.jobs.id,
      title: o.jobs.title,
      company: o.jobs.company ?? null,
      source: o.jobs.source ?? null,
      location: o.jobs.location ?? null,
      url: o.jobs.url ?? null,
      posted: o.jobs.posted ?? null,
      firstSeen: o.jobs.first_seen ?? null,
      foundFor: o.jobs.found_for ?? null,
    }));
}
