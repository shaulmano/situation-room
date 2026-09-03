import { serverClient } from '@/lib/server';
import Dismiss from '@/components/Dismiss';
import MarkApplied from '@/components/MarkApplied';

export const dynamic = 'force-dynamic';

export default async function Jobs({
  searchParams,
}: {
  searchParams: { days?: string; all?: string; role?: string };
}) {
  const sb = serverClient();
  const showAll = searchParams.all === '1';
  const role = searchParams.role ?? '';
  const days = Number(searchParams.days ?? 30);
  const since = new Date(Date.now() - days * 864e5).toISOString();

  // Anything already applied to is history, not a lead. It belongs on the
  // applications screen and only gets in the way here.
  const { data: applied } = await sb.from('applications').select('job_id');
  const appliedIds = new Set((applied ?? []).map((a: any) => a.job_id).filter(Boolean));

  let query = sb
    .from('matches')
    .select(
      'score, cv_id, reasons, red_flags, ' +
      'jobs!inner(id, title, company, source, location, url, first_seen, on_target, dismissed_at)'
    )
    .order('score', { ascending: false })
    .limit(400);

  if (!showAll) {
    query = query
      .eq('jobs.on_target', true)
      .is('jobs.dismissed_at', null)
            .gte('jobs.first_seen', since);
  }

  const { data } = await query;

  // One row per job: keep only the CV that scored it highest.
  const best = new Map<string, any>();
  for (const m of (data ?? []) as any[]) {
    const id = m.jobs?.id;
    if (!id || appliedIds.has(id)) continue;
    if (!best.has(id) || best.get(id).score < m.score) best.set(id, m);
  }
  let picked = [...best.values()].sort((a, b) => b.score - a.score);
  // cv_id already classifies the posting — the CV that scored it highest is the
  // job family it belongs to, so no second taxonomy is needed.
  if (role) picked = picked.filter((m) => m.cv_id === role);
  const rows = picked.slice(0, 60);

  const counts = [...best.values()].reduce<Record<string, number>>((acc, m) => {
    acc[m.cv_id] = (acc[m.cv_id] ?? 0) + 1;
    return acc;
  }, {});
  const base = showAll ? '/jobs?all=1' : `/jobs?days=${days}`;
  const ROLES: [string, string][] = [
    ['', 'הכל'], ['qa', 'QA'], ['program', 'ניהול פרויקטים'], ['delivery', 'גרסאות ו‑Delivery'],
  ];

  return (
    <>
      <div className="screen-head">
        <h2>משרות</h2>
        <div className="range">
          <a href="/jobs?days=7" className={!showAll && days === 7 ? 'on' : ''}>שבוע</a>
          <a href="/jobs?days=30" className={!showAll && days === 30 ? 'on' : ''}>חודש</a>
          <a href="/jobs?all=1" className={showAll ? 'on' : ''}>הכל</a>
        </div>
      </div>

      <div className="filters">
        {ROLES.map(([id, label]) => (
          <a
            key={id}
            href={id ? `${base}&role=${id}` : base}
            className={'filter' + (role === id ? ' on' : '')}
          >
            {label}
            <span className="n">{id ? (counts[id] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)}</span>
          </a>
        ))}
      </div>

      <p className="screen-note">
        {showAll
          ? 'כל המשרות במאגר, כולל ישנות ולא רלוונטיות.'
          : `פתוחות עכשיו — עדיין מופיעות בסריקה. נמצאו ב־${days} הימים האחרונים ולא הגשת אליהן.`}
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          <b>אין משרות חדשות בחלון הזה</b>
          נסה חלון רחב יותר, או בדוק במסך המקורות איזה מקור הפסיק להחזיר.
        </div>
      ) : (
        <div className="rows">
          {rows.map((m) => {
            const j = m.jobs;
            const why: string[] = (m.reasons ?? []).slice(0, 2);
            const flags: string[] = (m.red_flags ?? []).filter(
              (f: string) => !f.includes('אין תיאור')
            );
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
                      {flags.slice(0, 1).map((f) => <span className="chip crit" key={f}>{f}</span>)}
                      <span className="chip mute">{m.cv_id}</span>
                    </span>
                  )}
                </span>
                {j.url && (
                  <a className="apply" href={j.url} target="_blank" rel="noreferrer">
                    להגשה
                  </a>
                )}
                <MarkApplied id={j.id} cvId={m.cv_id} />
                <Dismiss id={j.id} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
