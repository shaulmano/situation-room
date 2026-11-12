import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { applyTarget, directLinks } from '@/lib/apply';
import { jobAge } from '@/lib/age';
import { companyKey, type WarmContact, contactsByCompanyKeys } from '@/lib/contacts';
import { postingKey } from '@/lib/dedupe';
import Dismiss from '@/components/Dismiss';
import DismissAll from '@/components/DismissAll';
import JobBrief from '@/components/JobBrief';
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

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: { source?: string; manual?: string };
}) {
  const sb = serverClient();
  const source = searchParams?.source ?? '';
  // 10.11.2026: שאול ביקש תג ידני על כל משרה שהגיעה מהחיפוש הממוקד, ופילטר
  // ידני, והוא מסתכל כאן. שניהם היו קיימים רק במסך המשרות.
  const onlyManual = searchParams?.manual === '1';

  const [convos, weekApps, needsReply, silent, lastSent, applied, lastImport, upcoming, warmPeople] = await Promise.all([
    // 9.11.2026: קודם נספר הסטטוס הנוכחי בלבד, ולכן דחייה אחרי ראיון מחקה
    // את הראיון מהמניין והאריח נשאר אפס גם אחרי ששאול סימן. stage מחזיק את
    // השלב הרחוק ביותר שההגשה הגיעה אליו, והוא לא נמחק.
    sb.from('applications').select('id', { count: 'exact', head: true })
      .not('stage', 'is', null),
    sb.from('applications').select('id', { count: 'exact', head: true }).gte('sent_at', ago(7)),
    sb.from('events').select('id', { count: 'exact', head: true }).eq('classification', 'info_request'),
    sb.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'silent'),
    sb.from('applications').select('sent_at').order('sent_at', { ascending: false }).limit(1),
    sb.from('applications').select('job_id'),
    sb.from('contacts').select('imported_at').order('imported_at', { ascending: false }).limit(1),
    // שיחות וראיונות שנקבעו. מה שהיה אתמול נשאר יום אחד נוסף, כדי שראיון
    // שהתקיים הבוקר לא ייעלם מהמסך לפני שנרשם מה קרה בו.
    sb.from('applications')
      .select('id, company, role, next_at, next_kind')
      .not('next_at', 'is', null)
      .gte('next_at', ago(1))
      .order('next_at', { ascending: true })
      .limit(5),
    // 12.11.2026: המספר שהוביל לבניית מסך /warm. 540 הגשות קרות הביאו
    // שתי שיחות, ובאותו זמן מחצית מהמשרות הפתוחות הן בחברה ששאול מכיר
    // בה מישהו. זה האריח שאמור להזיז אותו לשם.
    //
    // **הסדר כאן חייב להתאים לסדר הפירוק למעלה, אחד לאחד.** 12.11.2026:
    // השאילתה הזאת נשתלה באמצע הרשימה ופורקה בסוף, וכל התוצאות מאותה
    // נקודה זזו במקום אחד. הבאנר של השיחות הציג את אנשי הקשר כראיונות
    // מתוזמנים, עם "Invalid Date" על כל שורה, בדיוק במסך הבית.
    sb.from('contacts').select('company_key', { count: 'exact', head: false })
      .is('contacted_at', null).limit(5000),
  ]);

  const appliedIds = new Set((applied.data ?? []).map((a: any) => a.job_id).filter(Boolean));

  // Today first; a week is the fallback, not the default. This page answers
  // "what is there to do this morning", anything older belongs on /jobs.
  async function freshJobs(days: number) {
    const { data } = await sb
      .from('matches')
      .select(
        'score, cv_id, reasons, ' +
        'jobs!inner(id, title, company, source, location, url, first_seen, posted, on_target, dismissed_at, found_for, manual, manual_dup)'
      )
      .eq('jobs.on_target', true)
      .is('jobs.dismissed_at', null)
      .gte('jobs.first_seen', ago(days))
      .order('first_seen', { ascending: false, referencedTable: 'jobs' })
      .limit(900);

    const best = new Map<string, any>();
    for (const m of (data ?? []) as any[]) {
      const id = m.jobs?.id;
      if (!id) continue;
      if (!best.has(id) || best.get(id).score < m.score) best.set(id, m);
    }
    // One row per posting, not per board: the same job reaches the feed from
    // three boards at once, and the extra copies were being closed by hand.
    const merged = new Map<string, any[]>();
    for (const m of best.values()) {
      const k = postingKey(m.jobs.company, m.jobs.title);
      const list = merged.get(k) ?? [];
      list.push(m);
      merged.set(k, list);
    }

    return [...merged.values()]
      .filter((list) => !list.some((m) => appliedIds.has(m.jobs.id)))
      .map((list) => {
        const order = [...list].sort((a, b) => {
          const indirect = (m: any) => (applyTarget(m.jobs)?.indirect ? 1 : 0);
          return indirect(a) - indirect(b) ||
            new Date(b.jobs.first_seen).getTime() - new Date(a.jobs.first_seen).getTime();
        });
        return { ...order[0], copies: order };
      })
      .sort(
        (a, b) => new Date(b.jobs.first_seen).getTime() - new Date(a.jobs.first_seen).getTime()
      );
  }

  // Today only, with no fallback to the week. A quiet day should read as a
  // quiet day; padding it with older rows is how this page turned into a
  // second jobs list in the first place.
  // All of today, not a preview of it. Eight was an arbitrary cut that hid 39
  // of the 47 jobs found this morning.
  let picked = await freshJobs(1);

  // Which boards today's rows came from, counted per board. A row that three
  // boards listed counts once under each, because the question the filter
  // answers is "show me what this board brought", and that job is one of them.
  const sourcesOf = (m: any): string[] => [
    ...new Set<string>(
      m.copies.map((c: any) => (c.jobs.source as string) || '').filter(Boolean)
    ),
  ];
  const sourceCounts = picked.reduce<Record<string, number>>((acc, m) => {
    for (const s of sourcesOf(m)) acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const SOURCES = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  const isManual = (m: any) => m.copies.some((c: any) => c.jobs.manual);
  const manualCount = picked.filter(isManual).length;
  if (onlyManual) picked = picked.filter(isManual);
  if (source) picked = picked.filter((m) => sourcesOf(m).includes(source));
  const rows = picked;

  // כמה מהמשרות שעל המסך הן בחברה שיש בה איש קשר שעוד לא פנית אליו.
  // נספר מתוך מה שכבר נטען, בלי שאילתה נוספת.
  const warmKeys = new Set(
    ((warmPeople.data ?? []) as any[]).map((c) => c.company_key).filter(Boolean)
  );
  const warmHere = rows.filter((m: any) =>
    warmKeys.has(companyKey(m.jobs.company))
  ).length;

  // Every copy of every row on screen, so closing the set closes the duplicates
  // too instead of leaving them to come back tomorrow under another board.
  const allIds = rows.flatMap((m) => m.copies.map((c: any) => c.jobs.id as string));

  // Which of today's rows already has a tailored CV waiting, in one lookup.
  // Without this the only way to find a finished CV is to open every row.
  // The table arrives with migration 0005, so a missing table reads as "none"
  // rather than taking the screen down with it.
  const cvStatus = new Map<string, string>();
  if (rows.length > 0) {
    const { data: reqs } = await sb
      .from('cv_requests')
      .select('job_id, status, created_at')
      .in('job_id', allIds)
      .order('created_at', { ascending: false });

    for (const r of (reqs ?? []) as any[]) {
      if (!cvStatus.has(r.job_id)) cvStatus.set(r.job_id, r.status);
    }
  }

  // The people Shaul already knows at today's companies, in one lookup.
  const keys = [...new Set(rows.map((m) => companyKey(m.jobs.company)).filter(Boolean))];
  const warm = new Map<string, WarmContact[]>();
  if (keys.length > 0) {
    const select = 'id, full_name, title, linkedin_url, email, phone, contacted_at, company_key';
    const contacts = await contactsByCompanyKeys(sb, keys, select);

    const wanted = new Set(keys);
    for (const c of contacts as any[]) {
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
      {/* מה שנקבע בא לפני מה שנספר. שאול ביקש שכל מה שהוא צריך לעשות יהיה
          מול העיניים ולא בפעמון, ומשהו להיום הוא משימה רגילה ולא אדומה. */}
      {/* 12.11.2026: המספר שמוביל למסך הפניות דרך מכרים. הוא יושב כאן, מעל
          הכל, כי הוא הערוץ שהמדידה אמרה שהוא היחיד שמניב, ולא עוד אריח. */}
      {/* 12.11.2026: הבאנר היה מותנה ב-warmHere, שנספר מתוך משרות היום
          בלבד, ולכן ביום בלי משרות חדשות הוא נעלם. הערוץ הזה לא תלוי
          בסריקה של היום: המשרות הפתוחות בחברות שהוא מכיר בהן מישהו
          ממשיכות להיות שם. לכן הבאנר מוצג כל עוד יש בכלל אנשי קשר. */}
      {(warmHere > 0 || warmKeys.size > 0) && (
        <Link
          className="row"
          href="/warm"
          style={{
            background: 'var(--good-soft)', borderColor: 'var(--good)',
            marginBottom: 12,
          }}
        >
          <span className="chip ok">דרך מכר</span>
          <span className="grow">
            {warmHere > 0
              ? `${warmHere} מהמשרות כאן הן בחברה שאתה מכיר בה מישהו`
              : 'משרות פתוחות בחברות שאתה מכיר בהן מישהו'}
            <span className="sub">
              פנייה אישית במקום הגשה קרה. ההודעה מוכנה שם להעתקה.
            </span>
          </span>
          <span className="apply">פתח</span>
        </Link>
      )}

      {(upcoming.data ?? []).length > 0 && (
        <div className="rows" style={{ marginBottom: 14 }}>
          {(upcoming.data as any[]).map((u) => {
            const at = new Date(u.next_at);
            const mins = (at.getTime() - Date.now()) / 6e4;
            const today = at.toDateString() === new Date().toDateString();
            const when = at.toLocaleString('he-IL', {
              weekday: 'short', day: 'numeric', month: 'numeric',
              hour: '2-digit', minute: '2-digit',
            });
            return (
              <Link className="row" key={u.id} href="/applications?status=conversation">
                <span className={'chip ' + (mins < 0 ? 'warn' : today ? 'ok' : 'mute')}>
                  {u.next_kind === 'interview' ? 'ראיון' : 'שיחה'}
                </span>
                <span className="grow">
                  {u.company ?? u.role}
                  <span className="sub">
                    {[u.role, when].filter(Boolean).join(' · ')}
                    {mins < 0 ? ' · לרשום מה קרה' : ''}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="kpis">
        <Link className="kpi hero" href="/applications?status=conversation">
          {/* היעד היה ל-15/10 והתאריך עבר. אריח שמראה "0 ימים נותרו" לנצח
              הוא לא מדידה, ולכן אחרי שהתאריך חלף הוא מציג רק את המספר. */}
          <div className="kpi-l">
            שיחות וראיונות שהתקיימו{daysLeft > 0 ? ` · יעד ${CONVERSATION_TARGET} עד 15/10` : ''}
          </div>
          <div className="kpi-v">{convos.count ?? 0}</div>
          {daysLeft > 0 && <div className="kpi-foot">{daysLeft} ימים נותרו</div>}
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
        <h2>{source || 'חדשות היום'}</h2>
        <Link className="more" href="/jobs">כל המשרות ←</Link>
      </div>

      {/* Shown even for a single source: on a day when one board brought the
          whole screen, hiding the row hides the only way to reach "close all
          of them", which is the day it is most wanted. */}
      {SOURCES.length > 0 && (
        <div className="filters">
          {SOURCES.length > 1 && (
            <a href="/" className={'filter' + (source || onlyManual ? '' : ' on')}>
              כל המקורות
              <span className="n">{Object.values(sourceCounts).reduce((a, b) => a + b, 0)}</span>
            </a>
          )}
          {/* ידני: מה שהגיע מהחיפוש הממוקד על התפקידים של שאול, להבדיל
              מהסריקה הרחבה. נפרד משבבי המקורות, כי המשרה עדיין שייכת
              ללוח שממנו הגיעה. */}
          {manualCount > 0 && (
            <a
              href={onlyManual ? '/' : '/?manual=1'}
              className={'filter' + (onlyManual ? ' on' : '')}
            >
              ידני
              <span className="n">{manualCount}</span>
            </a>
          )}
          {SOURCES.map(([src, n]) => (
            // A selected chip clears itself, so one chip is still a working
            // toggle when there is no "all sources" chip to go back to.
            <a
              key={src}
              href={source === src ? '/' : `/?source=${encodeURIComponent(src)}`}
              className={'filter' + (source === src ? ' on' : '')}
            >
              {src}
              <span className="n">{n}</span>
            </a>
          ))}
        </div>
      )}

      {/* Only under a filter. On the unfiltered screen this would be a button
          that empties the day, one tap away from everything else. */}
      {source && rows.length > 0 && (
        <div className="scanbar">
          <DismissAll ids={allIds} label={source} />
        </div>
      )}

      <p className="screen-note">
        {rows.length > 0
          ? source
            ? `${rows.length} מ־${source} היום, ולא הגשת אליהן.`
            : `${rows.length} נסרקו היום ולא הגשת אליהן.`
          : 'הסריקה של היום לא החזירה משרות חדשות על המטרה.'}
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          {source ? (
            <>
              <b>אין משרות מ־{source} היום</b>
              <Link href="/">חזרה לכל המקורות</Link>
            </>
          ) : (
            <>
              <b>אין חדש היום</b>
              <Link href="/jobs?days=7">הצג את השבוע</Link> · או בדוק במסך המקורות אם מקור הפסיק להחזיר.
            </>
          )}
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
                    {/* 10.11.2026: התיוג היה רק במסך המשרות, ושאול מסתכל
                        כאן. שינוי לא נגמר עד שהוא בכל המסכים, וזה כלל
                        שהוא עצמו ביקש. */}
                    {m.copies.some((c: any) => c.jobs.manual) && (
                      <span className="chip warn">ידני</span>
                    )}
                    {/* "אם יש כפילות תסמן אותה ככפולה", שאול 10.11.2026:
                        החיפוש הידני מצא אותה, אבל היא כבר הייתה כאן. */}
                    {m.copies.some((c: any) => c.jobs.manual_dup) && (
                      <span className="chip mute">כפול</span>
                    )}
                    {(() => {
                      const found = m.copies
                        .map((c: any) => c.jobs.found_for)
                        .find(Boolean);
                      return found
                        ? <span className="chip ok">{found}</span>
                        : null;
                    })()}
                    {[...new Set(m.copies.map((c: any) => c.jobs.source))].map((src) => (
                      <span className="chip src" key={src as string}>{src as string}</span>
                    ))}
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
                <Dismiss id={j.id} ids={m.copies.map((c: any) => c.jobs.id)} />
                <JobContacts
                  contacts={warm.get(companyKey(j.company)) ?? []}
                  job={{ company: j.company, title: j.title, cvId: m.cv_id }}
                />
                <JobBrief
                  job={{
                    id: j.id, title: j.title, company: j.company,
                    url: j.url, cvId: m.cv_id,
                  }}
                  cvStatus={
                    (m.copies
                      .map((c: any) => cvStatus.get(c.jobs.id))
                      .find(Boolean) as any) ?? null
                  }
                />
              </div>
            );
          })}
        </div>
      )}

    </>
  );
}
