import { companyKey } from '@/lib/contacts';
import { cvFamilyForTitle } from '@/lib/outreach';
import { loadApplied } from '@/lib/priorApplication';
import { loadAliases } from '@/lib/gold';
import { jobPlace, cityOf } from '@/lib/jobLocation';
import { postingKey } from '@/lib/dedupe';

const CORE_ROLES = [
  'QA Director', 'QA Manager', 'Head of QA', 'QA Team Leader',
  'Project Manager', 'Program Manager', 'Release Manager',
];

/**
 * כמה כרטיסים "מוכנים לפנייה" (תכלת) יש במסך חברות זהב: חברה עם משרה מאומתת
 * ועם איש גיוס מאומת. אותם שערים כמו ב-`gold/page.tsx`, בלי בניית הכרטיסים,
 * כדי שהאריח בדף הבית יציג את אותו מספר. שינוי בשערים שם מחייב שינוי כאן.
 * נכשל בשקט: מחזיר null, והאריח חוזר להציג כוכב.
 */
export async function goldReadyCount(sb: any): Promise<number | null> {
  try {
    const aliases = await loadAliases(sb);
    const resolve = (k: string) => aliases.get(k) ?? k;

    const freshV = Date.now() - 14 * 86400000;
    const vKeys = new Set<string>();
    for (let from = 0; from < 8000; from += 1000) {
      const r = await sb.from('contacts')
        .select('verified_key, verified_at')
        .eq('verified_ok', true)
        .is('gold_skipped_at', null)
        .is('left_company_at', null)
        .not('verified_key', 'is', null)
        .not('linkedin_url', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + 999);
      if (r.error) return null;
      for (const c of (r.data ?? []) as any[]) {
        if (c.verified_at && new Date(c.verified_at).getTime() >= freshV) vKeys.add(c.verified_key);
      }
      if (!r.data || r.data.length < 1000) break;
    }
    if (!vKeys.size) return 0;

    const { rows: applied } = await loadApplied(sb);
    const appliedIds = new Set(applied.map((a: any) => a.job_id).filter(Boolean));
    const since = new Date(Date.now() - 60 * 86400000).toISOString();
    const jobs: any[] = [];
    for (let from = 0; from < 6000; from += 1000) {
      const r = await sb.from('jobs')
        .select('id, title, company, found_for, location, live_checked_at')
        .eq('on_target', true).is('closed_at', null).is('gold_skipped_at', null)
        .gte('first_seen', since)
        .order('first_seen', { ascending: false }).order('id', { ascending: true })
        .range(from, from + 999);
      if (r.error || !r.data) return null;
      jobs.push(...r.data);
      if (r.data.length < 1000) break;
    }
    const fresh = Date.now() - 48 * 3600 * 1000;
    const twinKey = (j: any) => postingKey(j.company, j.title);
    const appliedTwins = new Map<string, string[]>();
    for (const j of jobs) {
      if (!appliedIds.has(j.id)) continue;
      const arr = appliedTwins.get(twinKey(j)) ?? [];
      arr.push(cityOf(j.location));
      appliedTwins.set(twinKey(j), arr);
    }
    const keys = new Set<string>();
    for (const j of jobs) {
      if (appliedIds.has(j.id)) continue;
      const cities = appliedTwins.get(twinKey(j));
      const c = cityOf(j.location);
      if (cities && cities.some((x) => !x || !c || x === c)) continue;
      if (jobPlace(j.location) === 'out') continue;
      if (!cvFamilyForTitle(j.title) && !CORE_ROLES.includes(j.found_for)) continue;
      if (!j.live_checked_at || new Date(j.live_checked_at).getTime() < fresh) continue;
      const k0 = companyKey(j.company);
      if (!k0) continue;
      const k = resolve(k0);
      if (vKeys.has(k)) keys.add(k);
    }
    const list = [...keys];
    let n = list.length;
    for (let i = 0; i < list.length; i += 100) {
      const { data } = await sb.from('companies').select('company_key, gold_done_at, gold_skipped_at')
        .in('company_key', list.slice(i, i + 100));
      for (const c of (data ?? []) as any[]) if (c.gold_done_at || c.gold_skipped_at) n--;
    }
    return n;
  } catch { return null; }
}
