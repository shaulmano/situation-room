import Link from 'next/link';
import { serverClient } from '@/lib/server';
import Dismiss from '@/components/Dismiss';

export const dynamic = 'force-dynamic';

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

// last_seen looked like the freshness signal but the bot writes it once at
// discovery and never bumps it, so it is a discovery date under another name.
// Age is therefore only a proxy for "still open" — the reliable signal is the
// dismiss button, and jobs Shaul hides never come back.
const ACTIVE_DAYS = 3;

export default async function Dashboard() {
  const sb = serverClient();

  const [convos, weekApps, viewed, silent, lastSent, applied, top] = await Promise.all([
    sb.from('applications').select('id', { count: 'exact', head: true })
      .in('status', ['conversation', 'interview', 'offer']),
    sb.from('applications').select('id', { count: 'exact', head: true }).gte('sent_at', ago(7)),
    sb.from('applications').select('id', { count: 'exact', head: true })
      .in('status', ['acknowledged', 'replied', 'conversation', 'interview']),
    sb.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'silent'),
    sb.from('applications').select('sent_at').order('sent_at', { ascending: false }).limit(1),
    sb.from('applications').select('job_id'),
    sb.from('matches')
      .select('score, cv_id, reasons, jobs!inner(id, title, company, source, location, url, on_target, dismissed_at)')
      .eq('jobs.on_target', true)
      .is('jobs.dismissed_at', null)
      .gte('jobs.first_seen', ago(ACTIVE_DAYS))
      .order('score', { ascending: false })
      .limit(120),
  ]);

  const appliedIds = new Set((applied.data ?? []).map((a: any) => a.job_id).filter(Boolean));

  // One row per job — the same posting scores once per CV, and three identical
  // lines in a top-five list is not a top five.
  const best = new Map<string, any>();
  for (const m of (top.data ?? []) as any[]) {
    const id = m.jobs?.id;
    if (!id || appliedIds.has(id)) continue;
    if (!best.has(id) || best.get(id).score < m.score) best.set(id, m);
  }
  const rows = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 5);

  const last = lastSent.data?.[0]?.sent_at;
  const daysQuiet = last ? Math.floor((Date.now() - new Date(last).getTime()) / 864e5) : null;

  return (
    <>
      <div className="kpis">
        <div className="kpi hero">
          <div className="kpi-l">שיחות שהתקיימו</div>
          <div className="kpi-v">{convos.count ?? 0}</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">הגשות השבוע</div>
          <div className="kpi-v">{weekApps.count ?? 0}</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">נצפו על ידי מגייס</div>
          <div className="kpi-v">{viewed.count ?? 0}</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">ללא מענה</div>
          <div className="kpi-v">{silent.count ?? 0}</div>
        </div>
      </div>

      {daysQuiet !== null && daysQuiet > 14 && (
        <div className="alert">
          <b>{daysQuiet} ימים מאז ההגשה האחרונה.</b>{' '}
          נקודת הבדיקה ב־15/10 מודדת שיחות, ואין ממה שיצמחו.
        </div>
      )}

      <div className="screen-head">
        <h2>הכי מתאימות עכשיו</h2>
        <Link className="more" href="/jobs">כל המשרות ←</Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <b>אין משרות פתוחות על המטרה</b>
          משרה שהבוט הפסיק לראות בסריקות נחשבת סגורה ויורדת מכאן.
        </div>
      ) : (
        <div className="rows">
          {rows.map((m) => {
            const j = m.jobs;
            const why: string[] = (m.reasons ?? []).slice(0, 2);
            return (
              <div className="row job" key={j.id}>
                <span className="grow">
                  {j.title}
                  <span className="sub">
                    {[j.company, j.location].filter(Boolean).join(' · ')}
                  </span>
                  {(
                    <span className="why">
                      <span className="chip src">{j.source}</span>
                      {why.map((r) => <span className="chip ok" key={r}>{r}</span>)}
                      <span className="chip mute">{m.cv_id}</span>
                    </span>
                  )}
                </span>
                {j.url && (
                  <a className="apply" href={j.url} target="_blank" rel="noreferrer">להגשה</a>
                )}
                <Dismiss id={j.id} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
