import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// Applying happens on someone else's site, so nothing can observe it. This is
// the one thing only Shaul can tell the system, and it has to cost one tap.
export async function POST(req: NextRequest) {
  const { id, cv_id } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const sb = serverClient();
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, title, company, source')
    .eq('id', id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: jobErr?.message ?? 'job not found' }, { status: 404 });
  }

  const { error } = await sb.from('applications').insert({
    job_id: job.id,
    cv_id: cv_id ?? null,
    company: job.company,
    role: job.title,
    channel: job.source === 'LinkedIn' ? 'linkedin' : 'form',
    sent_at: new Date().toISOString(),
    status: 'sent',
    // Keeps the Gmail backfill from inserting a duplicate for the same posting.
    gmail_thread_id: `manual:${job.id}`,
  });

  if (error && !error.message.includes('duplicate')) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
