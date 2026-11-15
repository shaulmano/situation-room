import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// סימון הפנייה למי שפרסם את המודעה.
//
// המצב יושב על המשרה ולא על איש קשר: רוב המפרסמים אינם אנשי הקשר של שאול
// ואין להם שורה ב-contacts, והפנייה היא ממילא על המשרה הזאת ולא על האדם
// בכלל. אותו אדם יכול לפרסם שלוש משרות.

const COL = {
  // בקשת החברות שיצאה, ולא ההודעה. שני שדות כי אלה שני צעדים שונים:
  // הבקשה, האישור שלה, ואז ההודעה עם הקובץ.
  request: 'poster_request_at',
  sent: 'poster_sent_at',
  replied: 'poster_replied_at',
  skipped: 'poster_skipped_at',
} as const;

export async function POST(req: NextRequest) {
  const { action, ids, undo } = await req.json();
  const col = COL[action as keyof typeof COL];
  const list: string[] = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!col || list.length === 0) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  // כמה מזהים ולא אחד: אותו אדם פרסם כמה משרות ששאול הגיש אליהן, והפנייה
  // אליו היא אחת. לינקדאין מאפשרת בקשת חברות אחת, ולכן סימון הפנייה חייב
  // לכסות את כל המשרות שלו, אחרת השורה חוזרת לתור מחר.
  const sb = serverClient();
  const { error } = await sb
    .from('jobs')
    .update({ [col]: undo ? null : new Date().toISOString() })
    .in('id', list);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 14.11.2026. שאול פנה לטליה נובק נינו בטאב המפרסמים, ולמחרת היא הוצגה
  // שוב בטאב "השבוע" כאילו לא פנה: "פניתי אתמול ועדיין מופיעה כאילו לא
  // פניתי".
  //
  // הסיבה: "פניתי" היה שלוש עובדות נפרדות בשלושה מקומות. jobs.poster_sent_at
  // לטאב המפרסמים, contacts.contacted_at לשאר המסכים, ואף אחד מהם לא ידע על
  // השני. עכשיו פנייה למפרסם מסמנת גם את איש הקשר, אם הוא קיים אצלו, לפי
  // ה-slug של הפרופיל. זאת עובדה אחת על אדם אחד.
  if (action === 'sent' && !undo) {
    const { data: jobs } = await sb
      .from('jobs').select('id, recruiter_url').in('id', list);
    const slug = (u?: string | null) =>
      ((u ?? '').match(/\/in\/([A-Za-z0-9\-_%]+)/)?.[1] ?? '').toLowerCase();
    // 15.11.2026. אורן אבן ענה "can you please send a link to the desired
    // position" ולא היה מאיפה לקחת את הקישור. נמדד באותו בוקר: **אפס מתוך
    // 64** אנשי קשר שסומן שפנה אליהם נשאו משרה.
    //
    // כאן המשרה ידועה בוודאות, היא המודעה שאותו אדם פרסם, והיא פשוט לא
    // נכתבה. אותו דפוס שחוזר כאן בפעם החמישית: מידע שעבר במערכת ונזרק.
    const first = new Map<string, string>();
    for (const j of (jobs ?? []) as any[]) {
      const sg = slug(j.recruiter_url);
      if (sg && !first.has(sg)) first.set(sg, j.id);
    }
    for (const [sg, jobId] of first) {
      await sb.from('contacts')
        .update({ contacted_at: new Date().toISOString() })
        .ilike('linkedin_url', `%/in/${sg}%`)
        .is('contacted_at', null);
      // בנפרד, ועל מי שכבר סומן פעם: תאריך הפנייה הראשונה לא נדרס, אבל
      // שורה שאין עליה משרה כן מתמלאת. הצמדה של שניהם לאותו תנאי היא מה
      // שהשאיר את השדה ריק על כל 64 השורות.
      await sb.from('contacts')
        .update({ last_job_id: jobId })
        .ilike('linkedin_url', `%/in/${sg}%`)
        .is('last_job_id', null);
    }
  }

  return NextResponse.json({ ok: true });
}
