import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// הגשת הקובץ עצמו. הוא יושב בשורה כ-base64, כי קורות חיים של עמוד אחד
// שוקלים כמאה קילובייט, ודלי אחסון עם הרשאות וקישור ציבורי הוא הרבה יותר
// מכונאות ממה שהם מצדיקים.

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const { data, error } = await serverClient()
    .from('cv_requests')
    .select('pdf_base64, filename')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.pdf_base64) {
    return NextResponse.json({ error: 'הקובץ עדיין לא מוכן' }, { status: 404 });
  }

  const bytes = Buffer.from(data.pdf_base64, 'base64');
  // attachment ולא inline: הוא מגיש את זה למגייס, כלומר הוא רוצה קובץ ביד
  // ולא עוד לשונית פתוחה בדפדפן.
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
