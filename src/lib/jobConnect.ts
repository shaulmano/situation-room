import { companyKey, contactsByCompanyKeys, peopleAtCompanyHref } from '@/lib/contacts';
import { loadAliases, goldConnectNote } from '@/lib/gold';
import { loadApplied } from '@/lib/priorApplication';
import { israelDayStart } from '@/lib/wideReach';

/**
 * מגייסים לפי משרה: חברות עם משרה פתוחה שמתאימה לשאול ובלי אף איש קשר שלו.
 *
 * 26.11.2026. שאול: "איך אני מגדיל את כמות האנשים הרלוונטיים, מגייסות
 * ו-HR". המדידה: הגשה קרה 0.4% מול 7% דרך מכר, ולכן הצעד הוא בקשת חברות
 * עם הערה על משרה אמיתית. **אין כאן גריפה:** קישור לחיפוש בלינקדאין ושם
 * אף אדם לא נשמר. 10 ביום, וגם ויתור נספר, כמו בפנייה הרחבה.
 * נמדד כאן אחרי שבועיים: אם אף אחד לא מאשר, מורידים.
 */
export const JOB_CONNECT_DAILY = 10;

export type JobConnectRow = {
  key: string; company: string; jobId: string; jobTitle: string; jobUrl: string | null;
  searchHref: string; note: string; ageDays: number;
};

export async function loadJobConnect(sb: any): Promise<{ rows: JobConnectRow[]; left: number; done: number; error?: string }> {
  const dayStart = israelDayStart();
  const [{ data: asks, error: asksErr }, { rows: applied }, aliases] = await Promise.all([
    sb.from('job_connect_asks').select('company_key, asked_at, skipped_at'),
    loadApplied(sb),
    loadAliases(sb),
  ]);
  if (asksErr) return { rows: [], left: 0, done: 0, error: asksErr.message };

  const decided = new Set((asks ?? []).map((a: any) => a.company_key));
  const done = (asks ?? []).filter((a: any) =>
    (a.asked_at && a.asked_at >= dayStart) || (a.skipped_at && a.skipped_at >= dayStart)).length;
  const left = Math.max(0, JOB_CONNECT_DAILY - done);
  if (left === 0) return { rows: [], left, done };

  const keyOf = (name?: string | null) => { const k = companyKey(name); return k ? (aliases.get(k) ?? k) : ''; };
  const appliedIds = new Set(applied.map((a: any) => a.job_id).filter(Boolean));
  const appliedCos = new Set(applied.map((a: any) => keyOf((a as any).jobs?.company)).filter(Boolean));

  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: ms, error } = await sb.from('matches')
    .select('score, jobs!inner(id, title, company, url, first_seen, on_target, dismissed_at, closed_at)')
    .eq('jobs.on_target', true).is('jobs.dismissed_at', null).is('jobs.closed_at', null)
    .gte('jobs.first_seen', since)
    .order('score', { ascending: false })
    .limit(900);
  if (error) return { rows: [], left, done, error: error.message };

  const bestByCo = new Map<string, any>();
  for (const m of (ms ?? []) as any[]) {
    const j = m.jobs; if (!j?.id || appliedIds.has(j.id)) continue;
    const k = keyOf(j.company);
    if (!k || decided.has(k) || appliedCos.has(k)) continue;
    const cur = bestByCo.get(k);
    if (!cur || cur.score < m.score) bestByCo.set(k, m);
  }

  const known = await contactsByCompanyKeys(sb, [...bestByCo.keys()], 'company_key, left_company_at');
  const hasContact = new Set(known.filter((c: any) => !c.left_company_at).map((c: any) => c.company_key));

  const rows = [...bestByCo.entries()]
    .filter(([k]) => !hasContact.has(k))
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, left)
    .map(([k, m]) => {
      const j = m.jobs;
      return {
        key: k, company: j.company, jobId: j.id, jobTitle: j.title, jobUrl: j.url ?? null,
        searchHref: peopleAtCompanyHref(j.company, 'recruiter') ?? '',
        note: goldConnectNote({ name: '', company: j.company, jobTitle: j.title }),
        ageDays: Math.max(0, Math.round((Date.now() - new Date(j.first_seen).getTime()) / 864e5)),
      } as JobConnectRow;
    });
  return { rows, left, done };
}
