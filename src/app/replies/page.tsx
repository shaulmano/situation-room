import { serverClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

const CLS: Record<string, [string, string]> = {
  auto_ack: ['אישור אוטומטי', 'mute'],
  rejection: ['דחייה', 'crit'],
  info_request: ['בקשת מידע', 'warn'],
  interview: ['זימון', 'ok'],
  viewed: ['נצפה', 'warn'],
};

export default async function Replies() {
  const sb = serverClient();

  const [{ data: events }, { data: seen }] = await Promise.all([
    sb.from('events')
      .select('id, from_addr, subject, snippet, received_at, classification')
      .order('received_at', { ascending: false })
      .limit(60),
    sb.from('applications')
      .select('id, company, role, sent_at, status')
      .in('status', ['acknowledged', 'replied', 'conversation', 'interview'])
      .order('sent_at', { ascending: false })
      .limit(60),
  ]);

  const rows = events ?? [];
  const viewed = seen ?? [];

  return (
    <>
      <h2>תשובות</h2>

      {rows.length > 0 && (
        <div className="rows">
          {rows.map((e: any) => {
            const [txt, cls] = CLS[e.classification] ?? [e.classification ?? 'לא מסווג', 'mute'];
            return (
              <div className="row" key={e.id}>
                <span className={'chip ' + cls}>{txt}</span>
                <span className="grow">
                  {e.from_addr}
                  <span className="sub">{e.snippet ?? e.subject}</span>
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
              <span className="chip warn">נצפה</span>
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
