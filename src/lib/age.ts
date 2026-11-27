/**
 * How old a posting is, and how sure we are of that.
 *
 * There is no reliable signal for whether a job is still open — LinkedIn renders
 * the closed state client-side behind auth, and both the public page and the
 * guest endpoint answer 200 for a role that was filled weeks ago. Age is the
 * only proxy there is, so it belongs on the row rather than in a tooltip.
 *
 * Two clocks, and they are not the same claim:
 *   posted      — the date the source itself published. True age. 453 of 1,144
 *                 rows have one; the other boards simply do not say.
 *   first_seen  — when the bot first found it. A *lower bound*: a posting can
 *                 be a month old the first time a scraper reaches it.
 *
 * So the wording differs. "פורסם לפני 5 ימים" is a fact; "נמצא לפני 5 ימים" is
 * what we actually know. Presenting the second as the first would quietly turn
 * a floor into a measurement, and the whole point of showing age is that a
 * three-week-old posting is probably already filled.
 */
export type Age = { label: string; tone: 'fresh' | 'ok' | 'warn' | 'crit' };

const DAY = 864e5;

export function jobAge(posted: string | null, firstSeen: string | null): Age | null {
  const exact = !!posted;
  const from = posted ?? firstSeen;
  if (!from) return null;

  const t = new Date(exact ? `${posted}T00:00:00` : (from as string)).getTime();
  if (Number.isNaN(t)) return null;

  // יום קלנדרי בשעון ישראל, לא 24 שעות: אחרת "נמצא היום" ישב ליד תאריך של אתמול.
  const il = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
  const calDays = (ymd: string) => Math.round((Date.parse(il(Date.now())) - Date.parse(ymd)) / DAY);
  const ymd = exact ? (posted as string).slice(0, 10) : il(t);
  const days = Math.max(0, calDays(ymd));
  const verb = exact ? 'פורסם' : 'נמצא';

  const when = ` · ${Number(ymd.slice(8, 10))}.${Number(ymd.slice(5, 7))}`;
  const label =
    (days === 0 ? (exact ? 'פורסם היום' : 'נמצא היום')
    : days === 1 ? `${verb} אתמול`
    : `${verb} לפני ${days} ימים`) + when;

  // The bands are the ones the scoring already uses, so a row and its score
  // cannot tell different stories about the same posting.
  const tone: Age['tone'] =
    days <= 2 ? 'fresh' : days <= 7 ? 'ok' : days <= 21 ? 'warn' : 'crit';

  return { label, tone };
}

/**
 * מפתח מיון "מהחדש לישן" לפי תאריך הפרסום (27.11.2026, שאול). תאריך הפרסום הוא יום
 * בלי שעה, ולכן בתוך אותו יום מסדרים לפי מועד הכניסה למערכת. משרה בלי תאריך פרסום
 * נמדדת לפי מועד הכניסה.
 */
export function byPublished(a: { posted?: string | null; first_seen?: string | null }, b: { posted?: string | null; first_seen?: string | null }): number {
  const day = (j: { posted?: string | null; first_seen?: string | null }) =>
    new Date(j.posted ? `${j.posted}T00:00:00` : (j.first_seen ?? 0)).setHours(0, 0, 0, 0);
  return day(b) - day(a) || new Date(b.first_seen ?? 0).getTime() - new Date(a.first_seen ?? 0).getTime();
}
