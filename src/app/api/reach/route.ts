import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * סימון בפנייה הרחבה.
 *
 * 15.11.2026. **נפרד מ-`/api/contacts`** בכוונה: שם `contacted_at`
 * מסמן פנייה על משרה קונקרטית, וכאן מדובר בפנייה כללית. שאול ביקש
 * שהשניים לא יתערבבו, ולכן גם העמודות וגם הנתיב נפרדים.
 *
 * ביטול אפשרי: לחיצה בטעות על "נשלח" בלי לשלוח מוחקת אדם מהתור לנצח
 * בלי שאיש ישים לב.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = { updated_at: now };
  let touched = false;
  if (typeof body?.sent === 'boolean') { patch.wide_sent_at = body.sent ? now : null; touched = true; }
  if (typeof body?.skipped === 'boolean') { patch.wide_skipped_at = body.skipped ? now : null; touched = true; }
  if (!touched) return NextResponse.json({ error: 'nothing to set' }, { status: 400 });

  const { error } = await serverClient().from('contacts').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
