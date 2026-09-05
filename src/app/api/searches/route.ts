import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { expand, matches, rule } from '@/lib/expand';

/** More than this and one person's terms crowd out everyone else's scan time. */
const MAX_ACTIVE = 5;

// POST — save a search, and immediately decide which of the postings already in
// the pool belong to it.
//
// The backfill is not an optimisation. Every screen joins search_matches, so a
// search with no rows shows an empty feed however full the pool is — a new user
// would open the app on their first day, see nothing, and conclude it does not
// work. It runs here rather than waiting for the next scan for the same reason.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { label } = await req.json().catch(() => ({ label: '' }));
  const text = String(label ?? '').trim();
  if (!text) return NextResponse.json({ error: 'חסר תפקיד לחיפוש' }, { status: 400 });
  if (text.length > 80) return NextResponse.json({ error: 'ארוך מדי' }, { status: 400 });

  const sb = serverClient();

  const { count } = await sb
    .from('searches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('active', true);

  if ((count ?? 0) >= MAX_ACTIVE) {
    return NextResponse.json(
      { error: `עד ${MAX_ACTIVE} חיפושים פעילים. השהה אחד קודם.` },
      { status: 409 }
    );
  }

  const e = expand(text);

  const { data: search, error } = await sb
    .from('searches')
    .insert({
      user_id: user.id,
      label: text,
      terms: e.terms,
      // The scanner reads this and never re-derives it, so the app and the scan
      // cannot drift into disagreeing about what belongs to whom.
      rule: rule(e),
      seniority: e.seniority,
      expanded_by: e.by,
      expanded_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !search) {
    return NextResponse.json({ error: error?.message ?? 'לא נשמר' }, { status: 500 });
  }

  // Title only — the same rule the matcher itself follows, so what the preview
  // promised and what the feed shows cannot drift apart.
  const { data: jobs } = await sb.from('jobs').select('id, title');
  const hits = (jobs ?? []).filter((j) => matches(e, j.title));

  for (let i = 0; i < hits.length; i += 500) {
    await sb.from('search_matches').upsert(
      hits.slice(i, i + 500).map((j) => ({
        search_id: search.id,
        job_id: j.id,
        user_id: user.id,
      })),
      { onConflict: 'search_id,job_id' }
    );
  }

  return NextResponse.json({ ok: true, id: search.id, matched: hits.length });
}

// PATCH — pause or resume. A paused search stops costing scan time and stops
// producing alerts; its matches stay, so resuming is instant.
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { id, active } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const { data, error } = await serverClient()
    .from('searches')
    .update({ active: !!active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'no such search' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE — the matches go with it, by the cascade on search_matches.
export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  // Scoped to the caller as well as to the id: without the second clause this
  // is "delete any row whose uuid you can guess", and RLS would be the only
  // thing standing between a typo and someone else's search.
  const { error } = await serverClient()
    .from('searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
