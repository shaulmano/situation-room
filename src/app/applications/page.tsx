import { serverClient } from '@/lib/server';
export const dynamic = 'force-dynamic';

const LABEL: Record<string, [string, string]> = {
  sent: ['נשלח', 'mute'], acknowledged: ['נקלט', 'mute'], replied: ['נענה', 'ok'],
  conversation: ['שיחה', 'ok'], interview: ['ראיון', 'ok'],
  rejected: ['נדחה', 'crit'], silent: ['שקט', 'crit'],
};

export default async function Applications() {
  const { data } = await serverClient()
    .from('applications')
    .select('id, company, role, recipient, cv_id, sent_at, status')
    .order('sent_at', { ascending: false })
    .limit(100);
  const rows = data ?? [];
  return (
    <>
      <h2>הגשות</h2>
      {rows.length === 0 ? (
        <div className="empty"><b>אין הגשות</b>הסנכרון מג'ימייל עוד לא רץ.</div>
      ) : (
        <div className="rows">
          {rows.map((a: any) => {
            const [txt, cls] = LABEL[a.status] ?? [a.status, 'mute'];
            const days = Math.floor((Date.now() - new Date(a.sent_at).getTime()) / 864e5);
            return (
              <div className="row" key={a.id}>
                <span className="grow">{a.company ?? a.recipient}
                  <span className="sub">{[a.role, new Date(a.sent_at).toLocaleDateString('he-IL'), a.cv_id].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="chip mute">{days === 0 ? 'היום' : `${days} ימים`}</span>
                <span className={'chip ' + cls}>{txt}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
