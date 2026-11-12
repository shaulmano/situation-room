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

  const { data, error } = await serverClient()
    .from('referrals')
    .select('pdf_base64, filename')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.pdf_base64) {
    return NextResponse.json({ error: 'הקובץ עדיין לא מוכן' }, { status: 404 });
  }

  const bytes = Buffer.from(data.pdf_base64, 'base64');
  const name = (data.filename || 'cv.pdf').replace(/[^\w.\-]/g, '_');
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
