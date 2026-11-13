import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// סימון הפנייה למי שפרסם את המודעה.
//
// המצב יושב על המשרה ולא על איש קשר: רוב המפרסמים אינם אנשי הקשר של שאול
// ואין להם שורה ב-contacts, והפנייה היא ממילא על המשרה הזאת ולא על האדם
// בכלל. אותו אדם יכול לפרסם שלוש משרות.

const COL = {
  sent: 'poster_sent_at',
  replied: 'poster_replied_at',
  skipped: 'poster_skipped_at',
} as const;

export async function POST(req: NextRequest) {
  const { action, id, undo } = await req.json();
  const col = COL[action as keyof typeof COL];
  if (!col || !id) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const sb = serverClient();
  const { error } = await sb
    .from('jobs')
    .update({ [col]: undo ? null : new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
