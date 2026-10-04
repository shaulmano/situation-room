import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// No heuristic can tell a closed LinkedIn posting from an open one — the state
// is rendered client-side, behind auth. So the reliable signal is Shaul: one
// click and the job never comes back.
export async function POST(req: NextRequest) {
  const { id, ids, undo } = await req.json();
  // One posting sits in the feed once per board. Closing it has to close every
  // copy, or the duplicates are back tomorrow morning.
  const targets: string[] = Array.isArray(ids) && ids.length > 0 ? ids : id ? [id] : [];
  if (targets.length === 0) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  // Ask for the row back: an update that matched nothing is not an error in
  // PostgREST, so without this the route reported ok for an id that does not
  // exist — which is exactly what a broken button looks like from the client.
  const { data, error } = await serverClient()
    .from('jobs')
    .update({ dismissed_at: undo ? null : new Date().toISOString() })
    .in('id', targets)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'no such job' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// No heuristic can tell a closed LinkedIn posting from an open one — the state
// is rendered client-side, behind auth. So the reliable signal is Shaul: one
// click and the job never comes back.
export async function POST(req: NextRequest) {
  const { id, undo } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  // Ask for the row back: an update that matched nothing is not an error in
  // PostgREST, so without this the route reported ok for an id that does not
  // exist — which is exactly what a broken button looks like from the client.
  const { data, error } = await serverClient()
    .from('jobs')
    .update({ dismissed_at: undo ? null : new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'no such job' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
