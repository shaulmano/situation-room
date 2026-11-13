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
    .select('cv_id')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });

  // 13.11.2026: מה שמוצג במסך הוא מה שיישלח, ושניהם קובץ הבסיס של
  // שאול לפי משפחת התפקידים. קודם הוצגה כאן הגרסה שהמחולל כתב למשרה,
  // והוא ביקש שיצורף הקובץ המקורי.
  const { data: cv } = await sb
    .from('cvs')
    .select('pdf_base64, filename')
    .eq('id', data.cv_id ?? 'qa')
    .maybeSingle();

  const b64 = cv?.pdf_base64 ?? null;
  const fileName = cv?.filename ?? null;
  if (!b64) return NextResponse.json({ error: 'אין קובץ לגרסה הזאת' }, { status: 404 });

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
