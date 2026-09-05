import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The one query behind both feeds, and the one place the switch lives.
 *
 * There are two sources of "what belongs to me". `search_matches` is the real
 * one — a person's own searches, their own rows. `matches` is the original,
 * keyed (job_id, cv_id) against Shaul's three CVs, which is not a model that
 * survives a second user.
 *
 * They are not swapped on a deploy. A person with no active search falls
 * through to the old table, so the app on Shaul's phone is untouched until he
 * chooses otherwise by creating a search — and choosing back is deleting it.
 * Cutting over on a deploy would have meant one bad guess about his screens
 * costing him a working feed with no way back except a revert.
 */
export type FeedRow = {
  job: {
    id: string; title: string; company: string | null; source: string;
    location: string | null; url: string | null; first_seen: string;
    on_target: boolean; dismissed_at: string | null;
  };
  /** The search that brought it, or the CV that scored it. Named on the row. */
  from: string;
  fromId: string;
  /** Legacy only. The score is not maintained under searches — see 0003. */
  score: number | null;
  reasons: string[];
  flags: string[];
};

export type Feed = {
  rows: FeedRow[];
  mode: 'searches' | 'cvs';
  /** Filter chips: the person's searches, or the three CV families. */
  groups: { id: string; label: string; n: number }[];
};

const LEGACY_GROUPS: Record<string, string> = {
  qa: 'QA',
  program: 'ניהול פרויקטים',
  delivery: 'גרסאות ו‑Delivery',
};

export async function loadFeed(
  sb: SupabaseClient,
  opts: {
    since: string | null;
    appliedIds: Set<string>;
    /** The "everything" view: no window, no on-target gate, hidden rows included. */
    showAll?: boolean;
    /** Arriving from a source row on /מקורות. */
    source?: string;
    limit?: number;
  }
): Promise<Feed> {
  const limit = opts.limit ?? 1200;
  const all = opts.showAll === true;

  const { data: searches } = await sb
    .from('searches')
    .select('id, label')
    .eq('active', true);

  const JOB = 'jobs!inner(id, title, company, source, location, url, first_seen, on_target, dismissed_at)';

  if (!searches || searches.length === 0) {
    let q = sb.from('matches').select(`score, cv_id, reasons, red_flags, ${JOB}`)
      .order('first_seen', { ascending: false, referencedTable: 'jobs' })
      .limit(limit);
    if (!all) {
      q = q.eq('jobs.on_target', true).is('jobs.dismissed_at', null);
      if (opts.since) q = q.gte('jobs.first_seen', opts.since);
    }
    if (opts.source) q = q.eq('jobs.source', opts.source);

    const { data } = await q;
    // One row per job: the CV that scored it highest is the family it belongs
    // to, so no second taxonomy is needed.
    const best = new Map<string, FeedRow>();
    for (const m of (data ?? []) as any[]) {
      const j = m.jobs;
      if (!j?.id || opts.appliedIds.has(j.id)) continue;
      const prev = best.get(j.id);
      if (prev && (prev.score ?? 0) >= m.score) continue;
      best.set(j.id, {
        job: j,
        from: LEGACY_GROUPS[m.cv_id] ?? m.cv_id,
        fromId: m.cv_id,
        score: m.score,
        reasons: (m.reasons ?? []).slice(0, 2),
        flags: (m.red_flags ?? []).filter((f: string) => !f.includes('אין תיאור')),
      });
    }
    return finish([...best.values()], 'cvs',
      Object.entries(LEGACY_GROUPS).map(([id, label]) => ({ id, label })));
  }

  // Dismissals are personal now, so they cannot be a column on the posting. The
  // ids come back as a set and filter here: PostgREST has no NOT EXISTS, and a
  // person's dismissals are a few hundred rows at most.
  const { data: dismissed } = await sb.from('job_dismissals').select('job_id');
  const hidden = new Set((dismissed ?? []).map((d: any) => d.job_id));

  let q = sb.from('search_matches').select(`search_id, ${JOB}`)
    .order('first_seen', { ascending: false, referencedTable: 'jobs' })
    .limit(limit);
  if (!all && opts.since) q = q.gte('jobs.first_seen', opts.since);
  if (opts.source) q = q.eq('jobs.source', opts.source);

  const { data } = await q;
  const label = new Map(searches.map((s: any) => [s.id, s.label]));

  const seen = new Map<string, FeedRow>();
  for (const m of (data ?? []) as any[]) {
    const j = m.jobs;
    if (!j?.id || opts.appliedIds.has(j.id)) continue;
    if (!all && hidden.has(j.id)) continue;
    // A posting can answer two searches. It appears once, named for the first
    // one that claimed it — two rows for one job is a worse answer than an
    // imprecise label.
    if (seen.has(j.id)) continue;
    if (!label.has(m.search_id)) continue;
    seen.set(j.id, {
      job: j,
      from: label.get(m.search_id)!,
      fromId: m.search_id,
      score: null,
      reasons: [],
      flags: [],
    });
  }

  return finish([...seen.values()], 'searches',
    searches.map((s: any) => ({ id: s.id, label: s.label })));
}

function finish(
  rows: FeedRow[],
  mode: Feed['mode'],
  defs: { id: string; label: string }[]
): Feed {
  rows.sort(
    (a, b) => new Date(b.job.first_seen).getTime() - new Date(a.job.first_seen).getTime()
  );
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.fromId] = (acc[r.fromId] ?? 0) + 1;
    return acc;
  }, {});
  return {
    rows,
    mode,
    groups: defs.map((d) => ({ ...d, n: counts[d.id] ?? 0 })),
  };
}
