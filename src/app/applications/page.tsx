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
    .select('id, company, role, recipient, cv_id, channel, sent_at, status')
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

  const ENGAGED = ['acknowledged', 'replied', 'conversation', 'interview'];
  const seenTotal = rows.filter((a) => ENGAGED.includes(a.status)).length;

  // Same cut three ways. The share column is the point: volume without a
  // response rate beside it is the number that produced 145 applications and
  // no conversation.
  function breakdown(key: (a: any) => string) {
    const m = new Map<string, { total: number; seen: number }>();
    for (const a of rows) {
      const k = key(a) || '—';
      const cur = m.get(k) ?? { total: 0, seen: 0 };
      cur.total += 1;
      if (ENGAGED.includes(a.status)) cur.seen += 1;
      m.set(k, cur);
    }
    return [...m.entries()].sort((x, y) => y[1].total - x[1].total);
  }

  const CV_LABEL: Record<string, string> = {
    qa: 'QA', program: 'ניהול פרויקטים', delivery: 'גרסאות ו‑Delivery',
  };
  const CH_LABEL: Record<string, string> = {
    linkedin: 'לינקדאין', form: 'טופס באתר', email: 'מייל ישיר',
  };
  const byCv = breakdown((a) => CV_LABEL[a.cv_id] ?? a.cv_id);
  const byChannel = breakdown((a) => CH_LABEL[a.channel] ?? a.channel);
  const byStatus = breakdown((a) => (LABEL[a.status] ?? [a.status])[0]);

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

      <h2>פילוח</h2>
      <div className="splits">
        {[['לפי תפקיד', byCv], ['לפי ערוץ', byChannel], ['לפי סטטוס', byStatus]].map(
          ([title, data]) => (
            <div className="split" key={title as string}>
              <div className="split-h">{title as string}</div>
              {(data as [string, { total: number; seen: number }][]).map(([k, v]) => (
                <div className="split-row" key={k}>
                  <span className="split-l">{k}</span>
                  <span className="split-t">
                    <span className="split-b" style={{ width: `${(v.total / rows.length) * 100}%` }} />
                  </span>
                  <span className="split-n">{v.total}</span>
                  <span className="split-p">{v.total ? Math.round((v.seen / v.total) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      <p className="screen-note">העמודה האחרונה היא שיעור הצפייה — כמה מהן מגייס פתח.</p>

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
