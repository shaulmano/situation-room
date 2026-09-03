import Link from 'next/link';
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

// The scans table keys sources by id; jobs.source carries the display name the
// scraper stamped on each row, and the two were never the same string.
const NAME: Record<string, string> = {
  linkedin: 'LinkedIn', alljobs: 'AllJobs', drushim: 'דרושים', comeet: 'Comeet',
  gotfriends: 'GotFriends', experis: 'Experis', dialog: 'Dialog', sqlink: 'SQLink',
  nisha: 'נישה', malamteam: 'מלם תים', one1: 'ONE / טלדור', secretjobs: 'SecretJobs',
};
const JOB_SOURCE: Record<string, string> = {
  linkedin: 'LinkedIn', alljobs: 'AllJobs', drushim: 'Drushim', comeet: 'Comeet',
  gotfriends: 'GotFriends', experis: 'Experis', dialog: 'Dialog', sqlink: 'SQLink',
  nisha: 'Nisha', malamteam: 'Malam Team', one1: 'One1', secretjobs: 'SecretJobs',
};

const RANGES: [string, string, number][] = [
  ['1', 'היום', 1],
  ['7', 'שבוע', 7],
  ['all', 'הכל', 3650],
];

export default async function Sources({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const sb = serverClient();
  const key = searchParams.days ?? '1';
  const days = (RANGES.find((r) => r[0] === key) ?? RANGES[0])[2];
  const since = new Date(Date.now() - days * 864e5).toISOString();

  const [{ data: runs }, { data: scans }] = await Promise.all([
    sb.from('scan_runs')
      .select('id, started_at, finished_at, total, done, status, note')
      .order('started_at', { ascending: false }).limit(1),
    sb.from('scans')
      .select('source, raw, on_target, fresh, failed, reason, ran_at')
      .gte('ran_at', since)
      .order('ran_at', { ascending: false })
      .limit(2000),
  ]);

  // Summed across every scan in the window, not just the last one — over a week
  // "how much did this source bring" is the question, and one snapshot cannot
  // answer it. The failure flag stays from the most recent run: a source that
  // worked on Monday and died today is broken, not fine.
  const agg = new Map<string, {
    raw: number; on: number; fresh: number; runs: number;
    failed: boolean; reason: string | null; last: string | null;
  }>();

  for (const s of (scans ?? []) as any[]) {
    const cur = agg.get(s.source) ?? {
      raw: 0, on: 0, fresh: 0, runs: 0, failed: false, reason: null, last: null,
    };
    if (cur.last === null) {          // rows arrive newest-first
      cur.failed = !!s.failed;
      cur.reason = s.reason;
      cur.last = s.ran_at;
    }
    cur.raw += s.raw ?? 0;
    cur.on += s.on_target ?? 0;
    cur.fresh += s.fresh ?? 0;
    cur.runs += 1;
    agg.set(s.source, cur);
  }

  const rows = SCHEDULED.map((id) => ({ id, a: agg.get(id) ?? null }))
    .sort((x, y) => (y.a?.on ?? -1) - (x.a?.on ?? -1));

  const totalOn = rows.reduce((n, r) => n + (r.a?.on ?? 0), 0);
  const live = rows.filter((r) => (r.a?.on ?? 0) > 0).length;
  const scanCount = Math.max(0, ...rows.map((r) => r.a?.runs ?? 0));
  const newest = rows.map((r) => r.a?.last).filter(Boolean).sort().reverse()[0];
  const rangeLabel = (RANGES.find((r) => r[0] === key) ?? RANGES[0])[1];

  return (
    <>
      <div className="screen-head">
        <h2>מקורות</h2>
        <div className="range">
          {RANGES.map(([k, label]) => (
            <a key={k} href={`/sources?days=${k}`} className={key === k ? 'on' : ''}>
              {label}
            </a>
          ))}
        </div>
      </div>

      <ScanNow initial={(runs?.[0] as any) ?? null} />

      <p className="screen-note">
        {newest
          ? `${rangeLabel} · ${scanCount} סריקות · ${totalOn} משרות על המטרה מ־${live} מקורות · אחרונה ${new Date(newest).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}`
          : `לא נרשמה סריקה ב${rangeLabel === 'הכל' ? 'כלל' : `טווח "${rangeLabel}"`}.`}
      </p>

      <div className="rows">
        {rows.map(({ id, a }) => {
          const on = a?.on ?? 0;
          const state = !a ? ['לא נסרק', 'mute']
            : a.failed ? ['כשל', 'crit']
            : on > 0 ? ['תקין', 'ok']
            : ['אין על המטרה', 'warn'];
          const href = `/jobs?days=${key === 'all' ? 3650 : key}&source=${encodeURIComponent(JOB_SOURCE[id] ?? id)}`;
          return (
            <Link className="row" key={id} href={href}>
              <span className="grow">
                {NAME[id] ?? id}
                <span className="sub">
                  {a
                    ? `${a.raw.toLocaleString()} גולמי · ${a.fresh.toLocaleString()} ייחודיות · ${on} על המטרה · ${a.runs} סריקות${a.reason ? ' · ' + a.reason : ''}`
                    : 'לא רץ בטווח הזה'}
                </span>
              </span>
              {on > 0 && <span className="count">{on}</span>}
              <span className={'chip ' + state[1]}>{state[0]}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
