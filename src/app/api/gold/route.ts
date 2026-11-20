import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * סימון בחברות זהב: נשלח או ויתור, ברמת החברה. ביטול אפשרי, כי לחיצה
 * בטעות מורידה חברה מהתור בלי שום סימן.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const now = new Date().toISOString();
  // ויתור על איש קשר בודד, לא על כל החברה.
  if (typeof body?.contactId === 'string' && typeof body?.skipped === 'boolean') {
    const { error } = await serverClient().from('contacts')
      .update({ gold_skipped_at: body.skipped ? now : null }).eq('id', body.contactId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const patch: Record<string, string | null> = { updated_at: now };
  let touched = false;
  if (typeof body?.done === 'boolean') { patch.gold_done_at = body.done ? now : null; touched = true; }
  if (typeof body?.skipped === 'boolean') { patch.gold_skipped_at = body.skipped ? now : null; touched = true; }
  if (!touched) return NextResponse.json({ error: 'nothing to set' }, { status: 400 });
  const { error } = await serverClient().from('companies').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
