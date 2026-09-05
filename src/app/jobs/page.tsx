import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { applyTarget } from '@/lib/apply';
import Dismiss from '@/components/Dismiss';
import MarkApplied from '@/components/MarkApplied';
import { loadFeed } from '@/lib/feed';

export const dynamic = 'force-dynamic';

export default async function Jobs({
  searchParams,
}: {
  searchParams: { days?: string; all?: string; role?: string; source?: string };
}) {
  const sb = serverClient();
  const showAll = searchParams.all === '1';
  const role = searchParams.role ?? '';
  const source = searchParams.source ?? '';
  // Keep the family selection when the time window changes, and vice versa.
  const roleQ = (role ? `&role=${role}` : '') + (source ? `&source=${encodeURIComponent(source)}` : '');
  // Today by default: the feed is for acting on, and a week's backlog on open
  // is a reading list. The week is one tap away.
  const days = Number(searchParams.days ?? 1);
  const since = new Date(Date.now() - days * 864e5).toISOString();

  // Anything already applied to is history, not a lead. It belongs on the
  // applications screen and only gets in the way here.
  const { data: applied } = await sb.from('applications').select('job_id');
  const appliedIds = new Set((applied ?? []).map((a: any) => a.job_id).filter(Boolean));

  // Newest first, never by score: with no job descriptions every score lands in
  // the low forties, so ordering by it is ordering by noise. Under searches
  // there is no score at all — see lib/feed.
  const feed = await loadFeed(sb, { since, appliedIds, showAll, source });

  // No cut. A day is a day; truncating it just hides the tail.
  const rows = role ? feed.rows.filter((r) => r.fromId === role) : feed.rows;

  const base = (showAll ? '/jobs?all=1' : `/jobs?days=${days}`)
    + (source ? `&source=${encodeURIComponent(source)}` : '');
  const total = feed.rows.length;

  return (
    <>
      <div className="screen-head">
        <h2>{source || 'משרות'}</h2>
        <div className="range">
          <a href={`/jobs?days=1${roleQ}`} className={!showAll && days === 1 ? 'on' : ''}>היום</a>
          <a href={`/jobs?days=7${roleQ}`} className={!showAll && days === 7 ? 'on' : ''}>שבוע</a>
          <a href={`/jobs?all=1${roleQ}`} className={showAll ? 'on' : ''}>הכל</a>
        </div>
      </div>

      {/* Under searches these are the person's own searches, so the filter row
          is however many they have. Under the legacy CVs it is always three. */}
      <div className="filters">
        <a href={base} className={'filter' + (role === '' ? ' on' : '')}>
          הכל<span className="n">{total}</span>
        </a>
        {feed.groups.map((g) => (
          <a
            key={g.id}
            href={`${base}&role=${encodeURIComponent(g.id)}`}
            className={'filter' + (role === g.id ? ' on' : '')}
          >
            {g.label}<span className="n">{g.n}</span>
          </a>
        ))}
      </div>

      {source && (
        <p className="screen-note">
          מסונן למקור <b>{source}</b> · <Link href={`/jobs?days=${days}`}>כל המקורות ←</Link>
        </p>
      )}
      <p className="screen-note">
        {showAll
          ? 'כל המשרות במאגר, כולל ישנות ולא רלוונטיות.'
          : `נמצאו ${days === 1 ? 'היום' : `ב־${days} הימים האחרונים`} ולא הגשת אליהן. משרה שסגרת ב־✕ לא חוזרת.`}
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          <b>אין משרות חדשות בחלון הזה</b>
          נסה חלון רחב יותר, או בדוק במסך המקורות איזה מקור הפסיק להחזיר.
        </div>
      ) : (
        <div className="rows">
          {rows.map((m) => {
            const j = m.job;
            const why = m.reasons;
            const flags = m.flags;
            return (
              <div className="row job" key={j.id}>
                <span className="grow">
                  {j.title}
                  <span className="sub">
                    {[j.company, j.location].filter(Boolean).join(' · ')}
                  </span>
                  {(
                    <span className="why">
                      <span className="chip src">{j.source}</span>
                      {why.map((r) => <span className="chip ok" key={r}>{r}</span>)}
                      {flags.slice(0, 1).map((f) => <span className="chip crit" key={f}>{f}</span>)}
                      {/* Which search brought it. Under the legacy table this
                          is the CV family instead — same slot, same question:
                          why is this in front of me. */}
                      <span className="chip mute">{m.from}</span>
                    </span>
                  )}
                </span>
                {(() => {
                  const t = applyTarget(j);
                  return t ? (
                    <a
                      className={'apply' + (t.indirect ? ' indirect' : '')}
                      href={t.href} target="_blank" rel="noreferrer"
                      title={t.indirect ? 'המקור חסום מאחורי הרשמה — פותח חיפוש למשרה הזו' : undefined}
                    >
                      {t.label}
                    </a>
                  ) : null;
                })()}
                <MarkApplied id={j.id} cvId={feed.mode === "cvs" ? m.fromId : undefined} />
                <Dismiss id={j.id} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
