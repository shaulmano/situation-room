import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/server';
import { WIDE_CV_ID } from '@/lib/wideReach';

export const dynamic = 'force-dynamic';

/**
 * הקובץ של הפנייה הרחבה, להורדה.
 *
 * 15.11.2026, שאול: "יש אפשרות לצרף את הקובץ להודעה זה יחסוך לי זמן."
 *
 * **לינקדאין לא מאפשרת לצרף קובץ מבחוץ.** הצירוף קורה בתוך חלון
 * ההודעה שלה, ושליחה אוטומטית בשמו ממילא אסורה כאן. מה שכן אפשר הוא
 * להוריד פעם אחת ביום: מרגע שהקובץ יושב ב"אחרונים" של הטלפון, כל
 * צירוף הוא שתי נגיעות במקום חיפוש בין קבצים.
 */
export async function GET() {
  const { data, error } = await serverClient()
    .from('cvs')
    .select('pdf_base64, filename')
    .eq('id', WIDE_CV_ID)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.pdf_base64) {
    return NextResponse.json({ error: 'אין קובץ לגרסה הזאת' }, { status: 404 });
  }

  const bytes = Buffer.from(data.pdf_base64, 'base64');
  const name = (data.filename || 'cv.pdf').replace(/[^\w.\-]/g, '_');
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(bytes.length),
    },
  });
}
