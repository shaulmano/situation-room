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
      ? { status: 'approved', approved_at: new Date().toISOString() }
      : { status: 'canceled' };
    let q = sb.from('referrals').update(patch).in('id', ids);
    // 12.11.2026: הבדיקה עברה מהמייל למסך. עד היום אישור חל רק על שורה
    // שכבר נשלח עליה עותק בדיקה, כי המסך לא הציג את ההודעה ואת הקובץ
    // ולא היה מה לבדוק בו. עכשיו הוא מציג את שניהם, ולכן שאול מאשר משם.
    //
    // מה שלא השתנה: הדף הזה עדיין לא שולח כלום. הוא מסמן approved,
    // והשליחה יוצאת מהמשימה המתוזמנת. אל תוסיף כאן שליחה.
    //
    // והתנאי נשאר: אישור חל רק על שורה שממתינה. שורה שכבר נשלחה או
    // בוטלה לא חוזרת לחיים בלחיצה.
    if (action === 'approve') q = q.in('status', ['pending', 'test_sent']);
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
    .from('referrals')
    .upsert(rows, { onConflict: 'contact_id,job_id', ignoreDuplicates: true })
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // קורות החיים לפי המשרה מיוצרים בצינור שכבר קיים, cv_requests, ולא
  // במחולל שני. בלי זה הפנייה הייתה יוצאת עם קובץ גנרי, ושאול ביקש קובץ
  // לפי המשרה. אם כבר יש בקשה למשרה הזאת, לא נפתחת עוד אחת.
  const jobIds = [...new Set(items.map((it) => it.job_id))];
  const { data: existing } = await sb
    .from('cv_requests')
    .select('job_id')
    .in('job_id', jobIds);
  const have = new Set((existing ?? []).map((r: any) => r.job_id));
  const missing = items
    .filter((it) => !have.has(it.job_id))
    .map((it) => ({ job_id: it.job_id, base_cv_id: it.cv_id ?? null, status: 'pending' }))
    .filter((r, i, all) => all.findIndex((x) => x.job_id === r.job_id) === i);
  if (missing.length) await sb.from('cv_requests').insert(missing);

  return NextResponse.json({
    ok: true,
    queued: (data ?? []).length,
    cvs_requested: missing.length,
  });
}
