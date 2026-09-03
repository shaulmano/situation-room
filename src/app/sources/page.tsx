import { serverClient } from '@/lib/server';
import ScanNow from '@/components/ScanNow';

export const dynamic = 'force-dynamic';

// The twelve the bot is configured to scan. Listing them here rather than only
// what the scans table happens to hold means a source that stopped reporting
// shows up as a gap instead of vanishing from the screen.
const SCHEDULED = [
  'linkedin', 'alljobs', 'drushim', 'comeet', 'gotfriends', 'experis',
  'dialog', 'sqlink', 'nisha', 'malamteam', 'one1', 'secretjobs',
];

const NAME: Record<string, string> = {
  linkedin: 'LinkedIn', alljobs: 'AllJobs', drushim: 'דרושים', comeet: 'Comeet',
  gotfriends: 'GotFriends', experis: 'Experis', dialog: 'Dialog', sqlink: 'SQLink',
  nisha: 'נישה', malamteam: 'מלם תים', one1: 'ONE / טלדור', secretjobs: 'SecretJobs',
};

export default async function Sources() {
  const sb = serverClient();
  const { data: runs } = await sb
    .from('scan_runs')
    .select('id, started_at, finished_at, total, done, status, note')
    .order('started_at', { ascending: false })
    .limit(1);

  const { data } = await sb
    .from('scans')
    .select('source, raw, on_target, fresh, failed, reason, ran_at')
    .order('ran_at', { ascending: false })
    .limit(400);

  // Latest run per source — an average across runs hides a source that died today.
  const latest = new Map<string, any>();
  for (const s of (data ?? []) as any[]) {
    if (!latest.has(s.source)) latest.set(s.source, s);
  }

  const rows = SCHEDULED.map((id) => ({ id, scan: latest.get(id) ?? null }))
    .sort((a, b) => (b.scan?.on_target ?? -1) - (a.scan?.on_target ?? -1));

  const ran = [...latest.values()][0]?.ran_at;
  const totalOn = rows.reduce((n, r) => n + (r.scan?.on_target ?? 0), 0);
  const live = rows.filter((r) => (r.scan?.on_target ?? 0) > 0).length;

  return (
    <>
      <div className="screen-head">
        <h2>מקורות</h2>
      </div>
      <ScanNow initial={(runs?.[0] as any) ?? null} />
      <p className="screen-note">
        {ran
          ? `סריקה אחרונה ${new Date(ran).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })} · ${totalOn} משרות על המטרה מ־${live} מקורות פעילים`
          : 'עוד לא נרשמה סריקה.'}
      </p>

      <div className="rows">
        {rows.map(({ id, scan }) => {
          const on = scan?.on_target ?? 0;
          const state = !scan ? ['לא נסרק', 'mute']
            : scan.failed ? ['כשל', 'crit']
            : on > 0 ? ['תקין', 'ok']
            : ['אין על המטרה', 'warn'];
          return (
            <div className="row" key={id}>
              <span className="grow">
                {NAME[id] ?? id}
                <span className="sub">
                  {scan
                    ? `${scan.raw} גולמי · ${scan.fresh} ייחודיות · ${on} על המטרה${scan.reason ? ' · ' + scan.reason : ''}`
                    : 'אין נתוני סריקה'}
                </span>
              </span>
              {on > 0 && <span className="score hi">{on}</span>}
              <span className={'chip ' + state[1]}>{state[0]}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
