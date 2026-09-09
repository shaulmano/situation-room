import Link from 'next/link';
import { serverClient } from '@/lib/server';
import ScanNow from '@/components/ScanNow';

export const dynamic = 'force-dynamic';

// The screen is called "sources" and was read as "where do my jobs come from".
// It answered a different question: "when did I last scan this myself".
//
// Those came apart because postings reach the database by two paths and only
// one of them writes a `scans` row. The bot scrapes every 90 minutes, commits
// jobs.jsonl, and the sync copies it in — jobs appear, no scan row. The manual
// scan writes both. So on 09/09 this screen showed AllJobs at 232 and LinkedIn
// at 359 from a run six days earlier, presented as current, and showed nothing
// at all for Greenhouse, which had delivered that same day.
//
// What a source brought is now counted from the postings themselves, in the
// window on screen, whichever path carried them. The scan tallies stay as the
// second line, dated, because "97,290 raw → 27 on target" is the only thing
// that says whether a scraper is earning its runtime — but they are no longer
// what the screen leads with.
const KNOWN: [string, string, string][] = [
  // id (scans table) · display name · jobs.source string
  ['linkedin',   'LinkedIn',    'LinkedIn'],
  ['alljobs',    'AllJobs',     'AllJobs'],
  ['drushim',    'דרושים',      'Drushim'],
  ['comeet',     'Comeet',      'Comeet'],
  ['greenhouse', 'Greenhouse',  'Greenhouse'],
  ['gotfriends', 'GotFriends',  'GotFriends'],
  ['experis',    'Experis',     'Experis'],
  ['dialog',     'Dialog',      'Dialog'],
  ['sqlink',     'SQLink',      'SQLink'],
  ['nisha',      'נישה',        'Nisha'],
  ['malamteam',  'מלם תים',     'Malam Team'],
  ['one1',       'ONE / טלדור', 'One1'],
  ['secretjobs', 'SecretJobs',  'SecretJobs'],
];

const RANGES: [string, string, number][] = [
  ['1', 'היום', 1],
  ['7', 'שבוע', 7],
  ['all', 'הכל', 3650],
];

const short = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

export default async function Sources({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const sb = serverClient();
  const key = searchParams.days ?? '1';
  const days = (RANGES.find((r) => r[0] === key) ?? RANGES[0])[2];
  const since = new Date(Date.now() - days * 864e5).toISOString();

  const [{ data: runs }, { data: scans }, { data: arrived }] = await Promise.all([
    sb.from('scan_runs')
      .select('id, started_at, finished_at, total, done, status, note')
      .order('started_at', { ascending: false }).limit(1),
    sb.from('scans')
      .select('source, raw, on_target, fresh, failed, reason, ran_at')
      .gte('ran_at', since)
      .order('ran_at', { ascending: false })
      .limit(2000),
    // created_at, not first_seen: the question here is what reached this
    // database inside the window, and first_seen is the bot's own clock — a
    // posting it found last week and synced this morning belongs to today.
    sb.from('jobs')
      .select('source, on_target, created_at')
      .gte('created_at', since)
      .limit(5000),
  ]);

  const came = new Map<string, { n: number; on: number; last: string }>();
  for (const j of (arrived ?? []) as any[]) {
    const cur = came.get(j.source) ?? { n: 0, on: 0, last: j.created_at };
    cur.n += 1;
    if (j.on_target) cur.on += 1;
    if (j.created_at > cur.last) cur.last = j.created_at;
    came.set(j.source, cur);
  }

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

  // A source that delivered but is not in KNOWN still gets a row. That list is
  // hand-maintained and the pipeline is not; a new scraper should appear here
  // the day it brings something, not the day someone remembers to add it.
  const extra = [...came.keys()].filter((s) => !KNOWN.some((k) => k[2] === s));
  const rows = [
    ...KNOWN.map(([id, name, jobSource]) => ({ id, name, jobSource })),
    ...extra.map((s) => ({ id: s.toLowerCase(), name: s, jobSource: s })),
  ]
    .map((r) => ({ ...r, got: came.get(r.jobSource) ?? null, a: agg.get(r.id) ?? null }))
    .sort((x, y) => (y.got?.n ?? -1) - (x.got?.n ?? -1));

  const totalIn = rows.reduce((n, r) => n + (r.got?.n ?? 0), 0);
  const live = rows.filter((r) => (r.got?.n ?? 0) > 0).length;
  const rangeLabel = (RANGES.find((r) => r[0] === key) ?? RANGES[0])[1];

  // Worth retrying: scanned in the window and came back failed or empty. A
  // source nobody scanned is not a failure, it is a source nobody scanned.
  const failed = rows
    .filter(({ a }) => a && (a.failed || a.on === 0))
    .map(({ id }) => id);

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

      <ScanNow initial={(runs?.[0] as any) ?? null} failed={failed} />

      <p className="screen-note">
        {totalIn > 0
          ? `${rangeLabel} · ${totalIn} משרות נכנסו מ־${live} מקורות. הספירה היא מה שהגיע למסד — דרך הבוט או דרך סריקה ידנית.`
          : `${rangeLabel} · לא נכנסה אף משרה בטווח הזה.`}
      </p>

      <div className="rows">
        {rows.map(({ id, name, jobSource, got, a }) => {
          const n = got?.n ?? 0;
          const state = n > 0 ? ['מביא', 'ok']
            : a?.failed ? ['כשל בסריקה', 'crit']
            : a ? ['נסרק, אין תוצאות', 'warn']
            : ['שקט', 'mute'];

          // Two clocks on one line, each saying which it is. The scan tally can
          // be six days old while the arrivals are from this morning.
          const detail = [
            got ? `${n} נכנסו · אחרונה ${short(got.last)}` : 'לא נכנסה משרה',
            a
              ? `סריקה ${short(a.last!)}: ${a.raw.toLocaleString()} גולמי → ${a.on} על המטרה${a.reason ? ` · ${a.reason}` : ''}`
              : 'לא נסרק ידנית בטווח',
          ].join('  |  ');

          const href = `/jobs?days=${key === 'all' ? 3650 : key}&source=${encodeURIComponent(jobSource)}`;
          return (
            <Link className="row" key={id} href={href}>
              <span className="grow">
                {name}
                <span className="sub">{detail}</span>
              </span>
              {n > 0 && <span className="count">{n}</span>}
              <span className={'chip ' + state[1]}>{state[0]}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
