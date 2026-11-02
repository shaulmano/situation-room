import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// תיאור המשרה הוא הדבר היחיד שחסר כדי לכוון קורות חיים למשרה מסוימת, והוא
// גם מה שהופך את הציון למשהו אמיתי: score.py כבר קורא אותו ומוריד תקרה
// למשרה בלי תיאור. אף סקרייפר לא מביא אותו. מלינקדאין אי אפשר למשוך אותו
// בכלל, כי עמוד המשרה דורש התחברות ומשיכה אוטומטית היא הפרת תנאי שימוש.
//
// לכן הוא נכנס מהדבקה. שאול מעתיק את המודעה פעם אחת, והיא נשמרת על המשרה.

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const { data, error } = await serverClient()
    .from('jobs')
    .select('description')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ description: data?.description ?? '' });
}

export async function POST(req: NextRequest) {
  const { id, description } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  // מחרוזת ריקה מנקה, כדי שאפשר יהיה לתקן הדבקה שגויה ולא להישאר עם זבל.
  const text = typeof description === 'string' ? description.trim() : '';

  // מבקשים את השורה בחזרה: עדכון שלא תפס שום שורה אינו שגיאה ב-PostgREST,
  // ובלי זה המסלול היה מדווח הצלחה על מזהה שלא קיים.
  const { data, error } = await serverClient()
    .from('jobs')
    .update({ description: text || null })
    .eq('id', id)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'no such job' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, chars: text.length });
}
