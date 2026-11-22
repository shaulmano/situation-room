import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

// הוספה לתור השליחה, או ביטול של שורה שעוד לא נשלחה.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const sb = serverClient();
  if (b?.cancel && typeof b.id === 'string') {
    const { error } = await sb.from('li_outbox').update({ status: 'cancelled' })
      .eq('id', b.id).eq('status', 'queued');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (!b?.contactId || !b?.url || !b?.message) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  // אותו אדם לא נכנס פעמיים לתור.
  const { data: open } = await sb.from('li_outbox').select('id')
    .eq('contact_id', b.contactId).in('status', ['queued', 'sending']).limit(1);
  if (open && open.length) return NextResponse.json({ ok: true, id: open[0].id, already: true });
  const { data, error } = await sb.from('li_outbox').insert({
    contact_id: b.contactId, profile_url: b.url, to_name: b.name ?? null,
    message: b.message, cv_file: b.cvFile ?? null, job_id: b.jobId ?? null,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
