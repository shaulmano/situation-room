import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// תיבת הדואר שבין חדר המצב לקלוד.
//
// הכפתור כאן לא מייצר קורות חיים. הוא רושם שורה pending ב-cv_requests,
// ומשימה מתוזמנת בענן אוספת אותה, קוראת את תיאור המשרה ואת גרסת הבסיס,
// וכותבת את התוצאה חזרה לאותה שורה.
//
// למה לא קריאה ישירה מהאתר: לאתר אין דרך לקרוא לקלוד בלי מפתח API בחיוב
// נפרד מהמנוי. טבלה פותרת את זה בלי עלות, במחיר של המתנה קצרה.

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('job_id');
  if (!jobId) return NextResponse.json({ error: 'missing job_id' }, { status: 400 });

  // האחרונה בלבד. בקשה חוזרת על אותה משרה מחליפה את הקודמת מבחינת התצוגה.
  // בלי pdf_base64: הקובץ שוקל כמאה קילובייט, ובדיקת סטטוס לא צריכה אותו.
  // filename מתמלא רק כשהקובץ נכתב, ולכן הוא הסימן שיש מה להוריד.
  const { data, error } = await serverClient()
    .from('cv_requests')
    .select('id, status, filename, note, created_at, done_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data ?? null });
}

export async function POST(req: NextRequest) {
  const { job_id, base_cv_id, reject_id, feedback } = await req.json();
  if (!job_id) return NextResponse.json({ error: 'missing job_id' }, { status: 400 });

  const sb = serverClient();

  // דחייה: הגרסה הקודמת מסומנת נדחתה, וההערה עוברת לבקשה החדשה. בלי העברת
  // ההערה הייצור החוזר מחזיר את אותה גרסה בניסוח אחר, כי שום דבר לא מסמן
  // מה היה לא בסדר בקודמת.
  if (reject_id) {
    await sb
      .from('cv_requests')
      .update({ status: 'rejected', note: typeof feedback === 'string' ? feedback.trim() || null : null })
      .eq('id', reject_id);
  }

  // בלי תיאור אין מה לכוון מולו, והתוצאה הייתה גרסה גנרית שנראית כמו עבודה
  // אמיתית. עדיף לסרב כאן מאשר להחזיר משהו שלא שווה כלום.
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, description')
    .eq('id', job_id)
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'no such job' }, { status: 404 });
  if (!job.description || job.description.trim().length < 120) {
    return NextResponse.json(
      { error: 'קודם הדבק ושמור את תיאור המשרה' },
      { status: 400 },
    );
  }

  // בקשה שכבר ממתינה לא נרשמת פעמיים. לחיצה כפולה היא הדבר הטבעי לעשות
  // כשלא קורה כלום על המסך, ושתי בקשות זהות היו מייצרות עבודה כפולה.
  const { data: open } = await sb
    .from('cv_requests')
    .select('id, status, created_at')
    .eq('job_id', job_id)
    .in('status', ['pending', 'working'])
    .limit(1)
    .maybeSingle();

  if (open) return NextResponse.json({ ok: true, request: open, existing: true });

  const row: Record<string, unknown> = { job_id, status: 'pending' };
  if (typeof base_cv_id === 'string' && base_cv_id.trim()) row.base_cv_id = base_cv_id.trim();
  if (typeof feedback === 'string' && feedback.trim()) row.feedback = feedback.trim();

  const { data, error } = await sb
    .from('cv_requests')
    .insert(row)
    .select('id, status, created_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: data });
}
