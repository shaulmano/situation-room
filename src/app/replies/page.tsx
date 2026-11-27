import { serverClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

const CLS: Record<string, [string, string]> = {
  auto_ack: ['אישור אוטומטי', 'mute'],
  rejection: ['דחייה', 'crit'],
  info_request: ['בקשת מידע', 'warn'],
  interview: ['זימון', 'ok'],
  viewed: ['לינקדאין דיווח', 'warn'],
  conversation: ['שיחה', 'ok'],
};

export default async function Replies() {
  const sb = serverClient();

  // 27.11.2026: השורות הציגו רק "זימון / interview" בלי חברה ובלי תאריך, כי רוב האירועים הם
  // סימון סטטוס ידני שאין לו שולח ולא תוכן. עכשיו מצורפת ההגשה (חברה ותפקיד) ומוצג התאריך.
  // ה-join הוא PostgREST ו-tsc לא בודק אותו: אם נכשל, חוזרים לשליפה הפשוטה ולא לרשימה ריקה.
  const evFull = await sb.from('events')
    .select('id, from_addr, subject, snippet, received_at, classification, applications(company, role)')
    .order('received_at', { ascending: false })
    .limit(60);
  const evData = !evFull.error && evFull.data ? evFull.data : (await sb.from('events')
    .select('id, from_addr, subject, snippet, received_at, classification')
    .order('received_at', { ascending: false })
    .limit(60)).data;
  const [{ data: seen }] = await Promise.all([
    sb.from('applications')
      .select('id, company, role, sent_at, status')
      .in('status', ['acknowledged', 'replied', 'conversation', 'interview'])
      .order('sent_at', { ascending: false })
      .limit(60),
  ]);

  const rows = evData ?? [];
  const viewed = seen ?? [];

  return (
    <>
      <h2>תשובות</h2>
      <p className="screen-note">מסודר מהחדש לישן לפי מועד קבלת המייל. עד 60 אחרונות.</p>

      {rows.length > 0 && (
        <div className="rows">
          {rows.map((e: any) => {
            const [txt, cls] = CLS[e.classification] ?? [e.classification ?? 'לא מסווג', 'mute'];
            return (
              <div className="row" key={e.id}>
                <span className={'chip ' + cls}>{txt}</span>
                <span className="grow">
                  {e.applications?.company ?? e.from_addr}
                  <span className="sub">
                    {[e.applications?.role, e.snippet ?? (e.from_addr || e.applications ? null : e.subject), e.received_at ? new Date(e.received_at).toLocaleDateString('he-IL') : null]
                      .filter(Boolean).join(' · ')}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {rows.length === 0 && (
        <div className="empty">
          <b>אף מגייס לא כתב לך במייל</b>
          מכל ההגשות, אף אחת לא הביאה מייל אנושי חוזר. דחיות, זימונים ובקשות מידע
          יופיעו כאן ברגע שיגיע הראשון.
        </div>
      )}

      <h2>מי כן פתח את המועמדות</h2>
      <p className="screen-note">
        לינקדאין מדווח כשמגייס צופה בהגשה. זה האות היחיד שחזר, והוא לא תשובה — אבל
        הוא אומר שההגשה נקראה ולא נעצרה בסינון.
      </p>

      {viewed.length === 0 ? (
        <div className="empty"><b>אין צפיות רשומות</b>הסנכרון מג&apos;ימייל עוד לא רץ.</div>
      ) : (
        <div className="rows">
          {viewed.map((a: any) => (
            <div className="row" key={a.id}>
              <span className="chip warn">לינקדאין דיווח</span>
              <span className="grow">
                {a.company}
                <span className="sub">
                  {[a.role, new Date(a.sent_at).toLocaleDateString('he-IL')]
                    .filter(Boolean).join(' · ')}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
