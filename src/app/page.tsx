import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { applyTarget, directLinks } from '@/lib/apply';
import { jobAge } from '@/lib/age';
import { companyKey, type WarmContact } from '@/lib/contacts';
import Dismiss from '@/components/Dismiss';
import JobContacts from '@/components/JobContacts';
import MarkApplied from '@/components/MarkApplied';

export const dynamic = 'force-dynamic';

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

// The checkpoint the whole plan is measured against.
const CHECKPOINT = new Date('2026-10-15T00:00:00+03:00');
const CONVERSATION_TARGET = 3;

// A connections export is a manual errand at LinkedIn's end, so the app asks
// for a fresh one once a month and otherwise stays quiet about it.
const IMPORT_STALE_DAYS = 30;

export default async function Dashboard() {
  const sb = serverClient();

  const [convos, weekApps, needsReply, silent, lastSent, applied, lastImport] = await Promise.all([
    sb.from('applications').select('id', { count: 'exact', head: true })
      .in('status', ['conversation', 'interview', 'offer']),
    sb.from('applications').select('id', { count: 'exact', head: true }).gte('sent_at', ago(7)),
    sb.from('events').select('id', { count: 'exact', head: true }).eq('classification', 'info_request'),
    sb.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'silent'),
    sb.from('applications').select('sent_at').order('sent_at', { ascending: false }).limit(1),
    sb.from('applications').select('job_id'),
    sb.from('contacts').select('imported_at').order('imported_at', { ascending: false }).limit(1),
  ]);

  const appliedIds = new Set((applied.data ?? []).map((a: any) => a.job_id).filter(Boolean));

  // Today first; a week is the fallback, not the default. This page answers
  // "what is there to do this morning", anything older belongs on /jobs.
  async function freshJobs(days: number) {
    const { data } = await sb
      .from('matches')
      .select(
        'score, cv_id, reasons, ' +
        'jobs!inner(id, title, company, source, location, url, first_seen, posted, on_target, dismissed_at)'
      )
      .eq('jobs.on_target', true)
      .is('jobs.dismissed_at', null)
      .gte('jobs.first_seen', ago(days))
      .order('first_seen', { ascending: false, referencedTable: 'jobs' })
      .limit(900);

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
  // All of today, not a preview of it. Eight was an arbitrary cut that hid 39
  // of the 47 jobs found this morning.
  const rows = await freshJobs(1);

  // The people Shaul already knows at today's companies, in one lookup.
  const keys = [...new Set(rows.map((m) => companyKey(m.jobs.company)).filter(Boolean))];
  const warm = new Map<string, WarmContact[]>();
  if (keys.length > 0) {
    const select = 'id, full_name, title, linkedin_url, email, phone, company_key';
    const { data: contacts } = keys.length > 120
      ? await sb.from('contacts').select(select).limit(5000)
      : await sb.from('contacts').select(select).in('company_key', keys);

    const wanted = new Set(keys);
    for (const c of (contacts ?? []) as any[]) {
      if (!c.company_key || !wanted.has(c.company_key)) continue;
      const list = warm.get(c.company_key) ?? [];
      list.push(c);
      warm.set(c.company_key, list);
    }
  }

  const last = lastSent.data?.[0]?.sent_at;
  const daysQuiet = last ? Math.floor((Date.now() - new Date(last).getTime()) / 864e5) : null;
  const daysLeft = Math.max(0, Math.ceil((CHECKPOINT.getTime() - Date.now()) / 864e5));

  const importedAt = lastImport.data?.[0]?.imported_at;
  const importAge = importedAt
    ? Math.floor((Date.now() - new Date(importedAt).getTime()) / 864e5)
    : null;
  const importStale = importAge === null || importAge >= IMPORT_STALE_DAYS;

  return (
    <>
      {/* Every tile leads to the rows it counted: a number you cannot open is
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

      {importStale && (
        <p className="screen-note" style={{ marginTop: 14 }}>
          {importAge === null
            ? 'אנשי הקשר שלך מלינקדאין עדיין לא הועלו, ולכן אף משרה לא מראה מי מכיר שם.'
            : `הקשרים מלינקדאין עודכנו לפני ${importAge} ימים.`}{' '}
          <Link href="/settings">עדכון בהגדרות ←</Link>
        </p>
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

      {rows.length === 0 ? (
        <div className="empty">
          <b>אין חדש היום</b>
          <Link href="/jobs?days=7">הצג את השבוע</Link> · או בדוק במסך המקורות אם מקור הפסיק להחזיר.
        </div>
      ) : (
        <div className="rows">
          {rows.map((m) => {
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
                    {(() => {
                      const a = jobAge(j.posted, j.first_seen);
                      return a ? <span className={`chip age ${a.tone}`}>{a.label}</span> : null;
                    })()}
                    {why.map((r) => <span className="chip ok" key={r}>{r}</span>)}
                    <span className="chip mute">{m.cv_id}</span>
                  </span>
                </span>
                {t && (
                  <a
                    className={'apply' + (t.indirect ? ' indirect' : '')}
                    href={t.href} target="_blank" rel="noreferrer"
                    title={t.indirect ? 'המקור חסום מאחורי הרשמה, פותח חיפוש למשרה הזו' : undefined}
                  >
                    {t.label}
                  </a>
                )}
                {directLinks(j).map((d) => (
                  <a
                    key={d.label}
                    className="apply indirect"
                    href={d.href} target="_blank" rel="noreferrer"
                  >
                    {d.label}
                  </a>
                ))}
                <MarkApplied id={j.id} cvId={m.cv_id} />
                <Dismiss id={j.id} />
                <JobContacts contacts={warm.get(companyKey(j.company)) ?? []} />
              </div>
            );
          })}
        </div>
      )}

    </>
  );
}
