import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// מה שקרה אחרי ההגשה: שיחת טלפון, ראיון, דחייה, הצעה.
//
// 9.11.2026. עד היום לא הייתה שום דרך לרשום את זה. מסך ההגשות הציג
// 'conversation' ו-'interview', והסנכרון מג'ימייל ידע לקבוע רק 'acknowledged'
// ו-'silent', ולכן האריח "שיחות שהתקיימו" הראה אפס תמיד.
//
// ואחרי שנבנה, שאול סימן שתי הגשות ועדיין ראה אפס. שתי סיבות, ושתיהן
// מתוקנות כאן:
//
// 1. הרישום דרש הקשה שנייה על "שמור". עכשיו ההקשה הראשונה שומרת, והתאריך
//    וההערה הם עידון של שורה שכבר קיימת.
// 2. 'rejected' דרס את מה שהיה לפניו. עכשיו stage מחזיק את השלב הרחוק
//    ביותר שההגשה הגיעה אליו והוא לא נמחק, ו-status מחזיק את מה שקורה
//    עכשיו. ראיון שלא עבר הוא stage='interview' עם status='rejected'.

const ALLOWED = new Set([
  'sent', 'acknowledged', 'replied', 'conversation',
  'interview', 'offer', 'rejected', 'silent',
]);

// עד כמה רחוק הגיעה ההגשה. דחייה אינה שלב: היא סוף, ויכולה לבוא מכל שלב.
const RANK: Record<string, number> = { call: 1, interview: 2, offer: 3 };

export async function POST(req: NextRequest) {
  const { id, status, at, kind, note } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: `unknown status: ${status}` }, { status: 400 });
  }

  // תאריך שנשלח מהמסך הוא שעון מקומי בלי אזור. new Date() על מחרוזת כזאת
  // מפרש אותה כמקומית של השרת, שהוא UTC, וראיון בתשע בבוקר היה זז לאחת
  // עשרה. לכן נוסף האזור במפורש.
  let nextAt: string | null = null;
  if (at) {
    const parsed = new Date(/[Zz+]|\d{2}:\d{2}$/.test(at) ? at : `${at}:00+02:00`);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'bad date' }, { status: 400 });
    }
    nextAt = parsed.toISOString();
  }

  const sb = serverClient();
  const { data: before } = await sb
    .from('applications').select('stage, status').eq('id', id).single();

  const patch: Record<string, unknown> = { status, status_by: 'shaul' };

  // השלב הרחוק ביותר, ולעולם לא אחורה. הגשה שהגיעה לראיון ואז נדחתה
  // נשארת הגשה שהגיעה לראיון.
  const newStage = kind === 'interview' ? 'interview' : kind === 'call' ? 'call'
    : status === 'offer' ? 'offer' : '';
  if (newStage && (RANK[newStage] ?? 0) > (RANK[before?.stage ?? ''] ?? 0)) {
    patch.stage = newStage;
    patch.stage_at = nextAt ?? new Date().toISOString();
  }

  // דחייה סוגרת את מה שהיה קבוע, אבל לא את מה שכבר קרה.
  if (status === 'rejected' || status === 'offer') {
    patch.next_at = null;
    patch.next_kind = null;
  } else if (at !== undefined) {
    patch.next_at = nextAt;
    patch.next_kind = nextAt ? (kind ?? 'call') : null;
  }
  if (note !== undefined) patch.note = note || null;

  const { data, error } = await sb
    .from('applications')
    .update(patch)
    .eq('id', id)
    .select('id, company, stage, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // היסטוריה, לא רק מצב נוכחי: בעוד חודש השאלה תהיה מתי הייתה השיחה, לא מה
  // הסטטוס עכשיו. classified_by מבדיל בין זה לבין מה שהסנכרון כתב.
  await sb.from('events').insert({
    application_id: id,
    kind: 'status',
    received_at: new Date().toISOString(),
    subject: status,
    snippet: note || null,
    classification: status,
    classified_by: 'shaul',
  });

  return NextResponse.json({ ok: true, stage: data?.stage ?? null });
}
