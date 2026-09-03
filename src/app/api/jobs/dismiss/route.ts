import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// No heuristic can tell a closed LinkedIn posting from an open one — the state
// is rendered client-side, behind auth. So the reliable signal is Shaul: one
// click and the job never comes back.
export async function POST(req: NextRequest) {
  const { id, undo } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const { error } = await serverClient()
    .from('jobs')
    .update({ dismissed_at: undo ? null : new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
