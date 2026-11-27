import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// ביטול הגשה שסומנה בטעות מהמסך. מוחק רק שורה שנוצרה בסימון ידני
// (gmail_thread_id = manual:<id>), ולעולם לא הגשה שהגיעה ממייל.
export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const { data, error } = await serverClient()
    .from('applications').delete().eq('job_id', id).eq('gmail_thread_id', `manual:${id}`).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'no manual application to undo' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
