import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// הקובץ שיצורף לפנייה, כדי שאפשר יהיה לקרוא אותו במסך לפני השליחה.
//
// 12.11.2026, שאול: "יש אפשרות רביעית לראות את המייל על חדר המצב עם
// קורות החיים ומשם כפתור שלח". בלי הנתיב הזה הכפתור היה מבקש ממנו לאשר
// קובץ שהוא לא ראה, וזה בדיוק מה שמייל הבדיקה בא למנוע.

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const sb = serverClient();
  const { data, error } = await sb
    .from('referrals')
    .select('job_id, pdf_base64, filename')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });

  // ההעתקה לשורת הפנייה נעשית בתוך השולח, שרץ רק אחרי אישור. לכן אם
  // היא עוד לא קרתה, הקובץ נלקח ישירות מהמקום שבו הוא נוצר.
  let b64: string | null = data.pdf_base64 ?? null;
  let fileName: string | null = data.filename ?? null;
  if (!b64) {
    const { data: cv } = await sb
      .from('cv_requests')
      .select('pdf_base64, filename')
      .eq('job_id', data.job_id)
      .not('pdf_base64', 'is', null)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    b64 = cv?.pdf_base64 ?? null;
    fileName = fileName || cv?.filename || null;
  }

  if (!b64) return NextResponse.json({ error: 'הקובץ עדיין לא מוכן' }, { status: 404 });

  const bytes = Buffer.from(b64, 'base64');
  const name = (fileName || 'cv.pdf').replace(/[^\w.\-]/g, '_');
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
