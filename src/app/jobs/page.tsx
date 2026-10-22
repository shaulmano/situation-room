import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { applyTarget, directLinks } from '@/lib/apply';
import { jobAge } from '@/lib/age';
import { companyKey, type WarmContact } from '@/lib/contacts';
import { postingKey } from '@/lib/dedupe';
import Dismiss from '@/components/Dismiss';
import DismissAll from '@/components/DismissAll';
import JobContacts from '@/components/JobContacts';
import MarkApplied from '@/components/MarkApplied';

export const dynamic = 'force-dynamic';

export default async function Jobs({
  searchParams,
}: {
  searchParams: { days?: string; all?: string; role?: string; source?: string };
}) {
  const sb = serverClient();
  const showAll = searchParams.all === '1';
  const role = searchParams.role ?? '';
  const source = searchParams.source ?? '';
  // Keep the family selection when the time window changes, and vice versa.
  const roleQ = (role ? `&role=${role}` : '') + (source ? `&source=${encodeURIComponent(source)}` : '');
  // Today by default: the feed is for acting on, and a week's backlog on open
  // is a reading list. The week is one tap away.
  const days = Number(searchParams.days ?? 1);
  const since = new Date(Date.now() - days * 864e5).toISOString();

  // Anything already applied to is history, not a lead. It belongs on the
  // applications screen and only gets in the way here.
  const { data: applied } = await sb.from('applications').select('job_id');
  const appliedIds = new Set((applied ?? []).map((a: any) => a.job_id).filter(Boolean));

  let query = sb
    .from('matches')
    .select(
      'score, cv_id, reasons, red_flags, ' +
      'jobs!inner(id, title, company, source, location, url, first_seen, posted, on_target, dismissed_at)'
    )
    // Newest first. The score still picks which CV fits and produces the match
    // reasons, but it does not order the feed: with no job descriptions every
    // score lands in the low forties, so ordering by it is ordering by noise.
    .order('first_seen', { ascending: false, referencedTable: 'jobs' })
    // Raised from 1200 because the source filter is no longer a database
    // filter. It cannot be one: a posting is a row here only after its copies
    // from every board are grouped, so filtering before the grouping would
    // return the LinkedIn copy of a job and hide that Comeet also has it.
    .limit(3000);

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
    if (!id) continue;
    // Still the best-scoring CV per job, that is what the chip names.
    if (!best.has(id) || best.get(id).score < m.score) best.set(id, m);
  }
  // One row per posting, not per board. The copies travel with the row so that
  // every source stays reachable and so that closing the row closes all of them.
  const merged = new Map<string, any[]>();
  for (const m of best.values()) {
    const k = postingKey(m.jobs.company, m.jobs.title);
    const list = merged.get(k) ?? [];
    list.push(m);
    merged.set(k, list);
  }

  let picked = [...merged.values()]
    // Applied to through any one of its boards means applied to, full stop.
    .filter((list) => !list.some((m) => appliedIds.has(m.jobs.id)))
    .map((list) => {
      // A direct posting leads the row: applying on the company's own site
      // beats applying through whichever agency also listed it.
      const order = [...list].sort((a, b) => {
        const indirect = (m: any) => (applyTarget(m.jobs)?.indirect ? 1 : 0);
        return indirect(a) - indirect(b) ||
          new Date(b.jobs.first_seen).getTime() - new Date(a.jobs.first_seen).getTime();
      });
      return { ...order[0], copies: order };
    })
    .sort(
      (a, b) => new Date(b.jobs.first_seen).getTime() - new Date(a.jobs.first_seen).getTime()
    );
  // cv_id already classifies the posting: the CV that scored it highest is the
  // job family it belongs to, so no second taxonomy is needed.
  if (role) picked = picked.filter((m) => m.cv_id === role);

  // Which boards the rows on screen came from, counted per board. A row that
  // three boards listed counts once under each of them, because the question
  // the filter answers is "show me what this board brought", and that job is
  // one of the things it brought.
  const sourcesOf = (m: any): string[] => [
    ...new Set<string>(
      m.copies.map((c: any) => (c.jobs.source as string) || '').filter(Boolean)
    ),
  ];
  const sourceCounts = picked.reduce<Record<string, number>>((acc, m) => {
    for (const s of sourcesOf(m)) acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const SOURCES = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  if (source) picked = picked.filter((m) => sourcesOf(m).includes(source));
  // No cut. A day is a day; truncating it just hides the tail.
  const rows = picked;

  // Every copy of every row on screen, so that closing the set closes the
  // duplicates too rather than leaving them to come back under another board.
  const allIds = rows.flatMap((m) => m.copies.map((c: any) => c.jobs.id as string));

  // Who Shaul already knows at the companies on this screen. One query for the
  // whole feed, not one per row: at three hundred rows that is three hundred
  // round trips for what is a lookup.
  const keys = [...new Set(rows.map((m) => companyKey(m.jobs.company)).filter(Boolean))];
  const warm = new Map<string, WarmContact[]>();
  if (keys.length > 0) {
    const select = 'id, full_name, title, linkedin_url, email, phone, contacted_at, company_key';
    // Past a certain width the `in` list stops fitting in a url, so the whole
    // table comes over instead and the filtering happens here. A personal
    // network is a few thousand rows at most.
    const { data: contacts } = keys.length > 120
      ? await sb.from('contacts').select(select).limit(5000)
      : await sb.from('contacts').select(select).in('company_key', keys);

    const wanted = new Set(keys);
    for (const c of (contacts ?? []) as any[]) {
      if (!c.company_key || !wanted.has(c.company_key)) continue;
      const list = warm.get(c.company_key) ?? [];
      list.push(c);
      warm.set(c.company_key, list);
    }
  }

  const counts = [...best.values()].reduce<Record<string, number>>((acc, m) => {
    acc[m.cv_id] = (acc[m.cv_id] ?? 0) + 1;
    return acc;
  }, {});
  const window_ = showAll ? '/jobs?all=1' : `/jobs?days=${days}`;
  // Each row of chips changes its own dimension and keeps the other two, so
  // picking a board does not silently throw away the role you were looking at.
  const base = window_ + (source ? `&source=${encodeURIComponent(source)}` : '');
  const sourceBase = window_ + (role ? `&role=${role}` : '');
  const ROLES: [string, string][] = [
    ['', 'הכל'], ['qa', 'QA'], ['program', 'ניהול פרויקטים'], ['delivery', 'גרסאות ו‑Delivery'],
  ];

  return (
    <>
      <div className="screen-head">
        <h2>{source || 'משרות'}</h2>
        <div className="range">
          <a href={`/jobs?days=1${roleQ}`} className={!showAll && days === 1 ? 'on' : ''}>היום</a>
          <a href={`/jobs?days=7${roleQ}`} className={!showAll && days === 7 ? 'on' : ''}>שבוע</a>
          <a href={`/jobs?all=1${roleQ}`} className={showAll ? 'on' : ''}>הכל</a>
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

      {SOURCES.length > 1 && (
        <div className="filters">
          <a href={sourceBase} className={'filter' + (source ? '' : ' on')}>
            כל המקורות
            <span className="n">{Object.values(sourceCounts).reduce((a, b) => a + b, 0)}</span>
          </a>
          {SOURCES.map(([src, n]) => (
            <a
              key={src}
              href={`${sourceBase}&source=${encodeURIComponent(src)}`}
              className={'filter' + (source === src ? ' on' : '')}
            >
              {src}
              <span className="n">{n}</span>
            </a>
          ))}
        </div>
      )}

      {source && (
        <p className="screen-note">
          מסונן למקור <b>{source}</b> · <Link href={sourceBase}>כל המקורות ←</Link>
        </p>
      )}

      {/* Only under a filter. On the unfiltered feed this would be a button
          that empties the screen, which is not a thing to put one tap away. */}
      {source && rows.length > 0 && (
        <div className="scanbar">
          <DismissAll ids={allIds} label={source} />
        </div>
      )}

      <p className="screen-note">
        {showAll
          ? 'כל המשרות במאגר, כולל ישנות ולא רלוונטיות.'
          : `נמצאו ${days === 1 ? 'היום' : `ב־${days} הימים האחרונים`} ולא הגשת אליהן. משרה שסגרת ב־✕ לא חוזרת.`}
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
                      {[...new Set(m.copies.map((c: any) => c.jobs.source))].map((src) => (
                        <span className="chip src" key={src as string}>{src as string}</span>
                      ))}
                      {(() => {
                        const a = jobAge(j.posted, j.first_seen);
                        return a ? <span className={`chip age ${a.tone}`}>{a.label}</span> : null;
                      })()}
                      {why.map((r) => <span className="chip ok" key={r}>{r}</span>)}
                      {flags.slice(0, 1).map((f) => <span className="chip crit" key={f}>{f}</span>)}
                      <span className="chip mute">{m.cv_id}</span>
                    </span>
                  )}
                </span>
                {(() => {
                  const t = applyTarget(j);
                  return t ? (
                    <a
                      className={'apply' + (t.indirect ? ' indirect' : '')}
                      href={t.href} target="_blank" rel="noreferrer"
                      title={t.indirect ? 'המקור חסום מאחורי הרשמה, פותח חיפוש למשרה הזו' : undefined}
                    >
                      {t.label}
                    </a>
                  ) : null;
                })()}
                {directLinks(j).map((d) => (
                  <a
                    key={d.label}
                    className="apply indirect"
                    href={d.href} target="_blank" rel="noreferrer"
                  >
                    {d.label}
                  </a>
                ))}
                <MarkApplied id={j.id} cvId={m.cv_id} />
                <Dismiss id={j.id} ids={m.copies.map((c: any) => c.jobs.id)} />
                <JobContacts
                  contacts={warm.get(companyKey(j.company)) ?? []}
                  job={{ company: j.company, title: j.title, cvId: m.cv_id }}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
