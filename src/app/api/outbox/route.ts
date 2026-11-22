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
  // כמה שורות בבת אחת, מהפנייה הרחבה. כל שורה שנכנסת לתור נספרת כהחלטה
  // של היום (wide_sent_at). אם השליחה נכשלת, הסוכן מנקה אותו והאדם חוזר.
  if (Array.isArray(b?.items)) {
    const items = b.items.filter((i: any) => i?.contactId && i?.url && i?.message).slice(0, 50);
    if (items.length === 0) return NextResponse.json({ error: 'empty' }, { status: 400 });
    const ids = items.map((i: any) => i.contactId);
    const { data: open } = await sb.from('li_outbox').select('contact_id')
      .in('contact_id', ids).in('status', ['queued', 'sending']);
    const have = new Set((open ?? []).map((r: any) => r.contact_id));
    const fresh = items.filter((i: any) => !have.has(i.contactId));
    if (fresh.length) {
      const { error } = await sb.from('li_outbox').insert(fresh.map((i: any) => ({
        contact_id: i.contactId, profile_url: i.url, to_name: i.name ?? null,
        message: i.message, cv_file: i.cvFile ?? null, job_id: null, kind: 'wide',
      })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (b.wide) {
        await sb.from('contacts').update({ wide_sent_at: new Date().toISOString() })
          .in('id', fresh.map((i: any) => i.contactId));
      }
    }
    return NextResponse.json({ ok: true, queued: fresh.length });
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
