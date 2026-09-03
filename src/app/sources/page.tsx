import { serverClient } from '@/lib/server';
export const dynamic = 'force-dynamic';

export default async function Sources() {
  const { data } = await serverClient()
    .from('scans')
    .select('source, raw, on_target, fresh, failed, ran_at')
    .order('ran_at', { ascending: false })
    .limit(200);
  const agg = new Map<string, { raw: number; on: number; fresh: number; failed: boolean }>();
  for (const s of (data ?? []) as any[]) {
    const cur = agg.get(s.source) ?? { raw: 0, on: 0, fresh: 0, failed: false };
    cur.raw += s.raw ?? 0; cur.on += s.on_target ?? 0; cur.fresh += s.fresh ?? 0;
    cur.failed = cur.failed || !!s.failed;
    agg.set(s.source, cur);
  }
  const rows = [...agg.entries()].sort((a, b) => b[1].on - a[1].on);
  return (
    <>
      <h2>מקורות</h2>
      {rows.length === 0 ? (
        <div className="empty"><b>אין סריקות</b>הבוט עוד לא דיווח לכאן.</div>
      ) : (
        <div className="rows">
          {rows.map(([name, v]) => (
            <div className="row" key={name}>
              <span className="grow">{name}<span className="sub">{v.raw} גולמי · {v.on} על המטרה · {v.fresh} חדשות</span></span>
              <span className={'chip ' + (v.failed ? 'crit' : v.on > 0 ? 'ok' : 'warn')}>
                {v.failed ? 'כשל' : v.on > 0 ? 'תקין' : 'ריק'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
