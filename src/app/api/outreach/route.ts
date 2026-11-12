import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { referralMessage } from '@/lib/outreach';

// תור הפניות דרך מכרים.
//
// 12.11.2026. שאול מסמן אנשי קשר במסך, וכאן נכתבת שורה לכל פנייה. השליחה
// עצמה לא קורה כאן: היא יוצאת מהג'ימייל שלו דרך המשימה המתוזמנת, אחרי
// עותק בדיקה אליו ואחרי אישור מפורש. אף שורה לא עוברת לנמען האמיתי בלי
// שהוא לחץ "אשר".
//
// הדף הזה לא שולח כלום בעצמו, ולכן אין בו שום דרך לשלוח בטעות.

const ACTIONS = new Set(['queue', 'approve', 'cancel']);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? 'queue');
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }

  const sb = serverClient();

  if (action === 'approve' || action === 'cancel') {
    const ids: number[] = Array.isArray(body.ids) ? body.ids : [];
    if (!ids.length) return NextResponse.json({ error: 'no ids' }, { status: 400 });
    const patch = action === 'approve'
      // אישור חל רק על שורה שכבר נשלח עליה עותק בדיקה. אחרת "אשר" היה
      // יכול לדלג על הבדיקה, וזה בדיוק מה שהכלל בא למנוע.
      ? { status: 'approved', approved_at: new Date().toISOString() }
      : { status: 'canceled' };
    let q = sb.from('outreach').update(patch).in('id', ids);
    if (action === 'approve') q = q.eq('status', 'test_sent');
    const { data, error } = await q.select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, changed: (data ?? []).length });
  }

  // queue
  const items: any[] = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: 'no items' }, { status: 400 });

  const rows = items.map((it) => {
    const channel = it.email ? 'email' : 'linkedin';
    return {
      contact_id: it.contact_id,
      job_id: it.job_id,
      channel,
      cv_id: it.cv_id ?? null,
      subject: `${it.job_title} at ${it.company}`,
      body: referralMessage({
        contactName: it.contact_name,
        company: it.company,
        jobTitle: it.job_title,
        cvId: it.cv_id,
        // בקובץ מצורף אין טעם בשורת הקישור. שאול ביקש קובץ פיזי.
        attached: channel === 'email',
      }),
      status: 'pending',
    };
  });

  // אותו איש קשר לאותה משרה לא נכנס פעמיים, וסימון חוזר לא דורס שורה
  // שכבר נשלחה.
  const { data, error } = await sb
    .from('outreach')
    .upsert(rows, { onConflict: 'contact_id,job_id', ignoreDuplicates: true })
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, queued: (data ?? []).length });
}
