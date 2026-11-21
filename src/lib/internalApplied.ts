import { israelDayStart } from '@/lib/wideReach';

/**
 * כמה הגשות פנימיות (applications.channel = 'internal'). 21.11.2026, שאול:
 * "הקו החדש הוא לשלוח פנימית, ותספור את ההגשות, כי ככה רוב ההגשות יהיו."
 */
export async function internalApplied(sb: any): Promise<{ today: number; week: number; total: number }> {
  const day = israelDayStart();
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const c = (since?: string) => {
    let q = sb.from('applications').select('id', { count: 'exact', head: true }).eq('channel', 'internal');
    if (since) q = q.gte('sent_at', since);
    return q;
  };
  const [t, w, a] = await Promise.all([c(day), c(week), c()]);
  return { today: t.count ?? 0, week: w.count ?? 0, total: a.count ?? 0 };
}
