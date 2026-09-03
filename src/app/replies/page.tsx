import { serverClient } from '@/lib/server';
export const dynamic = 'force-dynamic';

const CLS: Record<string, [string, string]> = {
  auto_ack: ['אישור אוטומטי', 'mute'], rejection: ['דחייה', 'crit'],
  info_request: ['בקשת מידע', 'warn'], interview: ['זימון', 'ok'],
};

export default async function Replies() {
  const { data } = await serverClient()
    .from('events')
    .select('id, from_addr, subject, snippet, received_at, classification')
    .order('received_at', { ascending: false })
    .limit(80);
  const rows = data ?? [];
  return (
    <>
      <h2>תשובות</h2>
      {rows.length === 0 ? (
        <div className="empty"><b>אין תשובות</b>קריאת ג'ימייל עוד לא רצה.</div>
      ) : (
        <div className="rows">
          {rows.map((e: any) => {
            const [txt, cls] = CLS[e.classification] ?? [e.classification ?? 'לא מסווג', 'mute'];
            return (
              <div className="row" key={e.id}>
                <span className={'chip ' + cls}>{txt}</span>
                <span className="grow">{e.from_addr}
                  <span className="sub">{e.snippet ?? e.subject}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
