import { serverClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, [string, string]> = {
  sent: ['נשלח', 'mute'],
  acknowledged: ['נצפה', 'warn'],
  replied: ['נענה', 'ok'],
  conversation: ['שיחה', 'ok'],
  interview: ['ראיון', 'ok'],
  rejected: ['נדחה', 'crit'],
  silent: ['שקט', 'mute'],
};

const MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export default async function Applications() {
  const { data } = await serverClient()
    .from('applications')
    .select('id, company, role, recipient, cv_id, sent_at, status')
    .order('sent_at', { ascending: false });

  const rows = (data ?? []) as any[];
  if (rows.length === 0) {
    return (
      <>
        <h2>הגשות</h2>
        <div className="empty"><b>אין הגשות</b>הסנכרון מג&apos;ימייל עוד לא רץ.</div>
      </>
    );
  }

  // Every month between the first application and now, so a gap reads as a gap
  // rather than quietly closing up between two bars.
  const first = new Date(rows[rows.length - 1].sent_at);
  const buckets: { key: string; label: string; total: number; seen: number }[] = [];
  const index = new Map<string, number>();
  const cur = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date();
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}`;
    index.set(key, buckets.length);
    buckets.push({
      key,
      label: MONTHS[cur.getMonth()] + (cur.getMonth() === 0 ? ` ${String(cur.getFullYear()).slice(2)}` : ''),
      total: 0,
      seen: 0,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  for (const a of rows) {
    const d = new Date(a.sent_at);
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i === undefined) continue;
    buckets[i].total += 1;
    if (['acknowledged', 'replied', 'conversation', 'interview'].includes(a.status)) buckets[i].seen += 1;
  }
  const peak = Math.max(...buckets.map((b) => b.total), 1);

  const seenTotal = rows.filter((a) =>
    ['acknowledged', 'replied', 'conversation', 'interview'].includes(a.status)).length;

  return (
    <>
      <h2>הגשות</h2>

      <div className="kpis">
        <div className="kpi"><div className="kpi-l">סה״כ</div><div className="kpi-v">{rows.length}</div></div>
        <div className="kpi"><div className="kpi-l">נצפו על ידי מגייס</div><div className="kpi-v">{seenTotal}</div></div>
        <div className="kpi">
          <div className="kpi-l">שיעור צפייה</div>
          <div className="kpi-v">{Math.round((seenTotal / rows.length) * 100)}%</div>
        </div>
      </div>

      <h2>לפי חודש</h2>
      <div className="chart">
        {buckets.map((b) => (
          <div className="col" key={b.key}>
            <span className="col-n">{b.total || ''}</span>
            <span className="col-track">
              <span className="col-bar" style={{ height: `${(b.total / peak) * 100}%` }}>
                <span className="col-seen" style={{ height: b.total ? `${(b.seen / b.total) * 100}%` : '0%' }} />
              </span>
            </span>
            <span className="col-l">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="screen-note">
        הכהה בתוך כל עמודה הוא החלק שמגייס פתח.
      </p>

      <h2>אחרונות</h2>
      <div className="rows">
        {rows.slice(0, 25).map((a) => {
          const [txt, cls] = LABEL[a.status] ?? [a.status, 'mute'];
          const days = Math.floor((Date.now() - new Date(a.sent_at).getTime()) / 864e5);
          return (
            <div className="row" key={a.id}>
              <span className="grow">
                {a.company ?? a.recipient}
                <span className="sub">
                  {[a.role, new Date(a.sent_at).toLocaleDateString('he-IL'), a.cv_id]
                    .filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="chip mute">{days === 0 ? 'היום' : `${days} ימים`}</span>
              <span className={'chip ' + cls}>{txt}</span>
            </div>
          );
        })}
      </div>
      {rows.length > 25 && (
        <p className="screen-note">מוצגות 25 מתוך {rows.length}. השאר בגרף.</p>
      )}
    </>
  );
}
