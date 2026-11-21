import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const { data, error } = await serverClient()
    .from('jobs').update({ gold_skipped_at: new Date().toISOString() })
    .eq('id', id).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'no such job' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
