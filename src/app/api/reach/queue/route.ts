import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { AUTO_SEND_PER_DAY, WIDE_CV_FILE, displayName, israelDayStart, wideMessage } from '@/lib/wideReach';

export const dynamic = 'force-dynamic';

/**
 * שליחה אוטומטית של הפנייה הרחבה מהמחשב של שאול.
 *
 * 22.11.2026. שאול מאשר את הרשימה בלחיצה אחת, והסקריפט `send_outbox.py`
 * על המחשב שלו שולח מלינקדאין עם הקובץ המצורף. לינקדאין חוסמת את הראנר
 * בענן, ולכן אין שליחה משם.
 *
 * כל שורה שנכנסת לתור נספרת מיד כהחלטה של היום (`wide_sent_at`), כמו
 * "סמן שנשלח", כדי שהמכסה והאריח יסכמו אותו דבר. אם השליחה נכשלת הסקריפט
 * מנקה אותה והאדם חוזר לרשימה: החלטה שלא הושלמה לא נעלמת בשקט.
 *
 * ההודעה והקובץ נקבעים כאן בשרת מתוך המזהים בלבד. הלקוח לא שולח טקסט.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(b?.ids) ? b.ids.filter((x: any) => typeof x === 'string').slice(0, 25) : [];
  if (ids.length === 0) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const sb = serverClient();
  const { data: rows, error } = await sb.from('contacts')
    .select('id, full_name, linkedin_url, wide_sent_at, wide_skipped_at')
    .in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ok = (rows ?? []).filter((r: any) => r.linkedin_url && !r.wide_sent_at && !r.wide_skipped_at);
  if (ok.length === 0) return NextResponse.json({ ok: true, queued: 0 });

  const { data: open } = await sb.from('li_outbox').select('contact_id')
    .in('contact_id', ok.map((r: any) => r.id)).in('status', ['queued', 'sending']);
  const have = new Set((open ?? []).map((r: any) => r.contact_id));
  // תקרה יומית: מה שכבר נכנס לתור היום נספר, כדי שלחיצה כפולה או רענון
  // לא יעקפו אותה.
  const { count: today } = await sb.from('li_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'wide').gte('queued_at', israelDayStart());
  const room = Math.max(0, AUTO_SEND_PER_DAY - (today ?? 0));
  const fresh = ok.filter((r: any) => !have.has(r.id)).slice(0, room);
  if (fresh.length === 0) return NextResponse.json({ ok: true, queued: 0, room });

  const { error: insErr } = await sb.from('li_outbox').insert(fresh.map((r: any) => ({
    contact_id: r.id, profile_url: r.linkedin_url, to_name: r.full_name ?? null,
    message: wideMessage({ full_name: displayName(r.full_name) }), cv_file: WIDE_CV_FILE, job_id: null, kind: 'wide',
  })));
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const { error: upErr } = await sb.from('contacts')
    .update({ wide_sent_at: new Date().toISOString() }).in('id', fresh.map((r: any) => r.id));
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, queued: fresh.length });
}
