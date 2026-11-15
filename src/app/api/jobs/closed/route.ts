import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { postingKey } from '@/lib/dedupe';

/**
 * "המודעה כבר לא קיימת".
 *
 * 15.11.2026. שאול ביקש אופציה לסמן משרה שנסגרה, ועל השאלה מה הכוונה
 * ענה שהמודעה עצמה כבר לא קיימת, ולא שהוא לא מעוניין בה.
 *
 * **ההבדל מ-`/api/jobs/dismiss` הוא לא רק העמודה אלא מה נסגר.** ✕ סוגר
 * את העותקים שהמסך כבר מיזג לכרטיס אחד, כלומר מה שהוא ידע עליו. כאן
 * החיפוש הוא במסד: אותה חברה ואותה כותרת, בכל מקור ובכל כתובת. זה
 * בדיוק המקרה ששאול נתקל בו היום, Release Manager ב-VAST Data שהגיע
 * גם מלינקדאין וגם מ-Indeed בשתי כתובות, ושום דבר לא קישר ביניהן.
 *
 * מודעה שנסגרה נסגרה לכולם, ולכן אין כאן שיקול דעת: אם זאת אותה חברה
 * ואותה כותרת, זאת אותה מודעה.
 */
export async function POST(req: NextRequest) {
  const { id, ids, undo } = await req.json();
  const seed: string[] = Array.isArray(ids) && ids.length > 0 ? ids : id ? [id] : [];
  if (seed.length === 0) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const sb = serverClient();

  const { data: seedRows, error: seedErr } = await sb
    .from('jobs')
    .select('id, company, title')
    .in('id', seed);

  if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });
  if (!seedRows || seedRows.length === 0) {
    return NextResponse.json({ error: 'no such job' }, { status: 404 });
  }

  // התאומות. מסננים קודם לפי שם החברה, שזאת שאילתה שהמסד יודע לעשות,
  // ורק אז משווים את המפתח המלא כאן, כי הצמצום של companyKey אינו
  // ביטוי SQL ולא ניתן לשלוח אותו ל-PostgREST.
  const wanted = new Set(seedRows.map((r: any) => postingKey(r.company, r.title)));
  const companies = [...new Set(seedRows.map((r: any) => (r.company ?? '').trim()).filter(Boolean))];

  const targets = new Set<string>(seedRows.map((r: any) => r.id));
  for (const c of companies) {
    const { data: sameCo } = await sb
      .from('jobs')
      .select('id, company, title')
      .ilike('company', `%${c}%`)
      .limit(400);
    for (const r of sameCo ?? []) {
      if (wanted.has(postingKey(r.company, r.title))) targets.add(r.id);
    }
  }

  const stamp = undo ? null : new Date().toISOString();
  // גם `dismissed_at`, כי כל המסכים כבר מסננים עליו. בלי זה השורה
  // הייתה נשארת על המסך אחרי שסומנה כסגורה, וזה נראה כמו כפתור שבור.
  const { data, error } = await sb
    .from('jobs')
    .update({ closed_at: stamp, dismissed_at: stamp })
    .in('id', [...targets])
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'no such job' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, closed: data.length });
}
