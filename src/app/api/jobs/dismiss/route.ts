import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { currentUser, unauthorized } from '@/lib/auth';

// No heuristic can tell a closed LinkedIn posting from an open one — the state
// is rendered client-side, behind auth. So the reliable signal is a person: one
// click and the job never comes back.
//
// Hiding is a personal judgement, not a property of the posting. It is written
// to job_dismissals, keyed by user, so one person clearing their feed cannot
// clear anyone else's. jobs.dismissed_at is kept in step for the owner alone,
// because his screens still read that column; both go away together when the
// feed moves to search_matches.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { id, undo } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const sb = serverClient();

  // Ask for the row back: an update that matched nothing is not an error in
  // PostgREST, so without this the route reported ok for an id that does not
  // exist — which is exactly what a broken button looks like from the client.
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'no such job' }, { status: 404 });

  const { error } = undo
    ? await sb.from('job_dismissals').delete().eq('user_id', user.id).eq('job_id', id)
    : await sb
        .from('job_dismissals')
        .upsert({ user_id: user.id, job_id: id }, { onConflict: 'user_id,job_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (user.isOwner) {
    await sb
      .from('jobs')
      .update({ dismissed_at: undo ? null : new Date().toISOString() })
      .eq('id', id);
  }

  return NextResponse.json({ ok: true });
}
