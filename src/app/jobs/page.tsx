import { serverClient } from '@/lib/server';
export const dynamic = 'force-dynamic';

export default async function Jobs() {
  const { data } = await serverClient()
    .from('matches')
    .select('score, cv_id, jobs(title, company, source, location, url)')
    .order('score', { ascending: false })
    .limit(80);
  const rows = (data ?? []) as any[];
  return (
    <>
      <h2>משרות</h2>
      {rows.length === 0 ? (
        <div className="empty"><b>אין משרות מנוקדות</b>מנוע ההתאמה עוד לא רץ.</div>
      ) : (
        <div className="rows">
          {rows.map((m, i) => (
            <a className="row" key={i} href={m.jobs?.url ?? '#'} target="_blank" rel="noreferrer">
              <span className={'score ' + (m.score >= 85 ? 'hi' : m.score >= 60 ? 'mid' : 'lo')}>{m.score}</span>
              <span className="grow">{m.jobs?.title}
                <span className="sub">{[m.jobs?.company, m.jobs?.source, m.jobs?.location].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="chip mute">{m.cv_id}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
