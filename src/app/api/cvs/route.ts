import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// ספריית קורות החיים. הטבלה קיימת מאז 0001 ו-score.py כבר קורא ממנה את
// התוכן כדי לנקד משרות, אבל מעולם לא היה לה מסך: הגרסאות נכנסו ישירות
// למסד, ולכן אי אפשר היה לראות מה בדיוק מנוקד מולו או לתקן ניסוח.
//
// התוכן נשמר כטקסט ולא כקובץ בכוונה. קובץ אפשר רק להוריד; טקסט אפשר גם
// לנקד מולו, גם לקרוא, וגם לשמש כרפרנס לגרסה מכוונת למשרה.

export async function GET() {
  const { data, error } = await serverClient()
    .from('cvs')
    .select('id, label, filename, target_roles, content, updated_at')
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cvs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { id, label, filename, content } = await req.json();

  const key = typeof id === 'string' ? id.trim().toLowerCase() : '';
  // מזהה הוא גם המפתח ש-matches וההודעות בלינקדאין מצביעים אליו, ולכן הוא
  // חייב להיות יציב וצפוי. אותיות, ספרות ומקף בלבד.
  if (!/^[a-z0-9-]{2,24}$/.test(key)) {
    return NextResponse.json(
      { error: 'מזהה חייב להיות 2 עד 24 תווים: אותיות אנגליות, ספרות או מקף' },
      { status: 400 },
    );
  }

  const text = typeof content === 'string' ? content.trim() : '';
  if (text.length < 80) {
    return NextResponse.json(
      { error: 'התוכן קצר מדי. הדבק את קורות החיים המלאים' },
      { status: 400 },
    );
  }

  const row: Record<string, unknown> = {
    id: key,
    label: (typeof label === 'string' && label.trim()) || key,
    content: text,
    updated_at: new Date().toISOString(),
  };
  if (typeof filename === 'string' && filename.trim()) row.filename = filename.trim();

  const { error } = await serverClient()
    .from('cvs')
    .upsert(row, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: key, chars: text.length });
}
