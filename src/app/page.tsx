import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { applyTarget } from '@/lib/apply';
import Dismiss from '@/components/Dismiss';
import MarkApplied from '@/components/MarkApplied';

export const dynamic = 'force-dynamic';

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

// The checkpoint the whole plan is measured against.
const CHECKPOINT = new Date('2026-10-15T00:00:00+03:00');
const CONVERSATION_TARGET = 3;

export default async function Dashboard() {
  const sb = serverClient();

  const [convos, weekApps, needsReply, silent, lastSent, applied] = await Promise.all([
    sb.from('applications').select('id', { count: 'exact', head: true })
      .in('status', ['conversation', 'interview', 'offer']),
    sb.from('applications').select('id', { count: 'exact', head: true }).gte('sent_at', ago(7)),
    sb.from('events').select('id', { count: 'exact', head: true }).eq('classification', 'info_request'),
    sb.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'silent'),
    sb.from('applications').select('sent_at').order('sent_at', { ascending: false }).limit(1),
    sb.from('applications').select('job_id'),
  ]);

  const appliedIds = new Set((applied.data ?? []).map((a: any) => a.job_id).filter(Boolean));

  // Today first; a week is the fallback, not the default. This page answers
  // "what is there to do this morning" — anything older belongs on /jobs.
  async function freshJobs(days: number) {
    const { data } = await sb
      .from('matches')
      .select(
        'score, cv_id, reasons, ' +
        'jobs!inner(id, title, company, source, location, url, first_seen, on_target, dismissed_at)'
      )
      .eq('jobs.on_target', true)
      .is('jobs.dismissed_at', null)
      .gte('jobs.first_seen', ago(days))
      .order('first_seen', { ascending: false, referencedTable: 'jobs' })
      .limit(150);

    const best = new Map<string, any>();
    for (const m of (data ?? []) as any[]) {
      const id = m.jobs?.id;
      if (!id || appliedIds.has(id)) continue;
      if (!best.has(id) || best.get(id).score < m.score) best.set(id, m);
    }
    return [...best.values()].sort(
      (a, b) => new Date(b.jobs.first_seen).getTime() - new Date(a.jobs.first_seen).getTime()
    );
  }

  // Today only, with no fallback to the week. A quiet day should read as a
  // quiet day; padding it with older rows is how this page turned into a
  // second jobs list in the first place.
  const rows = await freshJobs(1);
  const shown = rows.slice(0, 8);

  const last = lastSent.data?.[0]?.sent_at;
  const daysQuiet = last ? Math.floor((Date.now() - new Date(last).getTime()) / 864e5) : null;
  const daysLeft = Math.max(0, Math.ceil((CHECKPOINT.getTime() - Date.now()) / 864e5));

  return (
    <>
      {/* Every tile leads to the rows it counted — a number you cannot open is
          a number you have to take on faith. */}
      <div className="kpis">
        <Link className="kpi hero" href="/applications?status=conversation">
          <div className="kpi-l">שיחות שהתקיימו · יעד {CONVERSATION_TARGET} עד 15/10</div>
          <div className="kpi-v">{convos.count ?? 0}</div>
          <div className="kpi-foot">{daysLeft} ימים נותרו</div>
        </Link>
        <Link className="kpi" href="/applications?range=week">
          <div className="kpi-l">הגשות השבוע</div>
          <div className="kpi-v">{weekApps.count ?? 0}</div>
        </Link>
        <Link className="kpi" href="/replies">
          <div className="kpi-l">דורש מענה</div>
          <div className="kpi-v">{needsReply.count ?? 0}</div>
        </Link>
        <Link className="kpi" href="/applications?status=silent">
          <div className="kpi-l">ללא מענה</div>
          <div className="kpi-v">{silent.count ?? 0}</div>
        </Link>
      </div>

      {daysQuiet !== null && daysQuiet > 14 && (
        <div className="alert">
          <b>{daysQuiet} ימים מאז ההגשה האחרונה.</b>{' '}
          נקודת הבדיקה מודדת שיחות, ואין ממה שיצמחו.
        </div>
      )}

      <div className="screen-head">
        <h2>חדשות היום</h2>
        <Link className="more" href="/jobs">כל המשרות ←</Link>
      </div>
      <p className="screen-note">
        {rows.length > 0
          ? `${rows.length} נסרקו היום ולא הגשת אליהן.`
          : 'הסריקה של היום לא החזירה משרות חדשות על המטרה.'}
      </p>

      {shown.length === 0 ? (
        <div className="empty">
          <b>אין חדש היום</b>
          <Link href="/jobs?days=7">הצג את השבוע</Link> · או בדוק במסך המקורות אם מקור הפסיק להחזיר.
        </div>
      ) : (
        <div className="rows">
          {shown.map((m) => {
            const j = m.jobs;
            const why: string[] = (m.reasons ?? []).slice(0, 2);
            const t = applyTarget(j);
            return (
              <div className="row job" key={j.id}>
                <span className="grow">
                  {j.title}
                  <span className="sub">
                    {[j.company, j.location].filter(Boolean).join(' · ')}
                  </span>
                  <span className="why">
                    <span className="chip src">{j.source}</span>
                    {why.map((r) => <span className="chip ok" key={r}>{r}</span>)}
                    <span className="chip mute">{m.cv_id}</span>
                  </span>
                </span>
                {t && (
                  <a
                    className={'apply' + (t.indirect ? ' indirect' : '')}
                    href={t.href} target="_blank" rel="noreferrer"
                    title={t.indirect ? 'המקור חסום מאחורי הרשמה — פותח חיפוש למשרה הזו' : undefined}
                  >
                    {t.label}
                  </a>
                )}
                <MarkApplied id={j.id} cvId={m.cv_id} />
                <Dismiss id={j.id} />
              </div>
            );
          })}
        </div>
      )}

      {rows.length > shown.length && (
        <p className="screen-note">
          מוצגות {shown.length} מתוך {rows.length}. <Link href="/jobs">השאר במסך משרות</Link>.
        </p>
      )}
    </>
  );
}
