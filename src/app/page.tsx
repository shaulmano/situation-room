import { serverClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

function since(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString();
}

export default async function Dashboard() {
  const sb = serverClient();
  const weekAgo = since(7);

  const [apps, convos, replies, silent, top] = await Promise.all([
    sb.from('applications').select('id', { count: 'exact', head: true }).gte('sent_at', weekAgo),
    sb.from('applications').select('id', { count: 'exact', head: true }).in('status', ['conversation', 'interview', 'offer']),
    sb.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'replied'),
    sb.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'silent'),
    sb.from('matches').select('score, jobs(title, company, source, location)').order('score', { ascending: false }).limit(5),
  ]);

  const rows = (top.data ?? []) as any[];

  return (
    <>
      <div className="kpis">
        <div className="kpi hero">
          <div className="kpi-l">שיחות שהתקיימו</div>
          <div className="kpi-v">{convos.count ?? 0}</div>
        </div>
        <div className="kpi"><div className="kpi-l">הגשות השבוע</div><div className="kpi-v">{apps.count ?? 0}</div></div>
        <div className="kpi"><div className="kpi-l">נענו</div><div className="kpi-v">{replies.count ?? 0}</div></div>
        <div className="kpi"><div className="kpi-l">שקט</div><div className="kpi-v">{silent.count ?? 0}</div></div>
      </div>

      <h2>המשרות הכי מתאימות</h2>
      {rows.length === 0 ? (
        <div className="empty">
          <b>אין עדיין נתונים</b>
          הסנכרון הראשון מהבוט ומג'ימייל עוד לא רץ.
        </div>
      ) : (
        <div className="rows">
          {rows.map((m, i) => (
            <div className="row" key={i}>
              <span className={'score ' + (m.score >= 85 ? 'hi' : m.score >= 60 ? 'mid' : 'lo')}>{m.score}</span>
              <span className="grow">
                {m.jobs?.title}
                <span className="sub">{[m.jobs?.company, m.jobs?.source, m.jobs?.location].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
