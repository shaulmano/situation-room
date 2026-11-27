import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { goldKeySet, goldGenericMessage } from '@/lib/gold';
import { applyTarget, directLinks } from '@/lib/apply';
import { jobAge } from '@/lib/age';
import { companyKey, type WarmContact, contactsByCompanyKeys } from '@/lib/contacts';
import { duplicateCandidates, postingKey } from '@/lib/dedupe';
import { loadApplied, priorApplication } from '@/lib/priorApplication';
import PriorApplied from '@/components/PriorApplied';
import DuplicateCheck from '@/components/DuplicateCheck';
import Dismiss from '@/components/Dismiss';
import CopyNote from '@/components/CopyNote';
import { connectNote } from '@/lib/outreach';
import DismissAll from '@/components/DismissAll';
import JobBrief from '@/components/JobBrief';
import JobContacts from '@/components/JobContacts';
import MarkApplied from '@/components/MarkApplied';
import CopyGeneric from '@/components/CopyGeneric';
import { cvFileFor } from '@/lib/outreach';
import MarkClosed from '@/components/MarkClosed';

export const dynamic = 'force-dynamic';

export default async function Jobs({
  searchParams,
}: {
  searchParams: { days?: string; all?: string; role?: string; source?: string; manual?: string };
}) {
  const sb = serverClient();
  const showAll = searchParams.all === '1';
  const role = searchParams.role ?? '';
  const source = searchParams.source ?? '';
  // 10.11.2026: שאול חיפש "טאב ידני". המקור נשאר מה שהוא, ולכן זה סינון
  // נפרד ולא עוד שבב ברשימת המקורות.
  const onlyManual = searchParams.manual === '1';

  // חמשת התפקידים ששאול נתן ב-10.11.2026, בשמות שהסורק באמת מחפש בהם.
  // "Director QA" הוא "QA Director" ברשימת הסריקה, ו-"QA Team Lead" הוא
  // "QA Team Leader". בלי המיפוי הזה הסינון היה מחזיר אפס ונראה שבור.
  // 10.11.2026, אחרי מדידה: שני תפקידי ה-QA ששאול נתן החזירו אפס, בזמן
  // ש"QA Manager", שלא היה ברשימתו, החזיר 47 ו-"Head of QA" אחת. השוק
  // בישראל מפרסם מנהל איכות בכיר כ-QA Manager. בלי שניהם הסינון היה מראה
  // 70 משרות Release Manager ומסתיר 47 משרות QA, כלומר ההפך מהכוונה.
  // שאול אישר להוסיף. אלה לא מרחיבים את הסריקה, רק את מה שהסינון מראה.
  const CORE_ROLES = [
    'QA Director', 'QA Manager', 'Head of QA', 'QA Team Leader',
    'Project Manager', 'Program Manager', 'Release Manager',
  ];
  const isCore = (m: any) =>
    m.copies.some((c: any) => CORE_ROLES.includes(c.jobs.found_for));
  // Keep the family selection when the time window changes, and vice versa.
  const roleQ = (role ? `&role=${role}` : '') + (source ? `&source=${encodeURIComponent(source)}` : '');
  // Today by default: the feed is for acting on, and a week's backlog on open
  // is a reading list. The week is one tap away.
  const days = Number(searchParams.days ?? 1);
  const since = new Date(Date.now() - days * 864e5).toISOString();

  // Anything already applied to is history, not a lead. It belongs on the
  // applications screen and only gets in the way here.
  //
  // 15.11.2026: גם הכותרת והחברה, ולא רק המזהה. הזיהוי במערכת הוא לפי
  // כתובת, ולכן אותה משרה מלוח אחר היא שורה חדשה שאין עליה שום סימן
  // שהוגשה. ראה src/lib/priorApplication.ts.
  const { rows: applied, idx: priorIdx } = await loadApplied(sb);
  const appliedIds = new Set(applied.map((a: any) => a.job_id).filter(Boolean));

  // 27.11.2026: מסד של שורות התאמה חמש לכל משרה. הסדר היה על הטבלה המשובצת ולא על
  // השורות עצמן, והשרת מחזיר עד 1000 שורות לבקשה, ולכן בתצוגת "הכל" נחתכו משרות
  // לא לפי תאריך. עכשיו מסדרים לפי תאריך המשרה ומדפדפים עד 5000 שורות.
  let embedOrder = true;
  const buildQuery = (a: number, b: number) => {
    let q = sb
      .from('matches')
      .select(
        'score, cv_id, reasons, red_flags, ' +
        'jobs!inner(id, title, company, source, location, url, first_seen, posted, on_target, dismissed_at, manual, found_for, manual_dup, recruiter_name, recruiter_url)'
      )
      .order(embedOrder ? 'jobs(first_seen)' : 'job_id', { ascending: false })
      .order('job_id')
      .range(a, b);
    if (!showAll) {
      q = q
        .eq('jobs.on_target', true)
        .is('jobs.dismissed_at', null)
        // סגורה לפי אימות: מוסתרת בתצוגה הרגילה, ונשארת בתצוגת הכל (showAll)
        .is('jobs.closed_at', null)
        .gte('jobs.first_seen', since);
    }
    return q;
  };
  const data: any[] = [];
  for (let a = 0; a < 5000; a += 1000) {
    let { data: part, error: perr } = await buildQuery(a, a + 999);
    if (perr && embedOrder) { embedOrder = false; ({ data: part, error: perr } = await buildQuery(a, a + 999)); }
    if (perr) break;
    data.push(...(part ?? []));
    if (!part || part.length < 1000) break;
  }

  // One row per job: keep only the CV that scored it highest.
  const best = new Map<string, any>();
  for (const m of (data ?? []) as any[]) {
    const id = m.jobs?.id;
    if (!id) continue;
    // Still the best-scoring CV per job, that is what the chip names.
    if (!best.has(id) || best.get(id).score < m.score) best.set(id, m);
  }
  // One row per posting, not per board. The copies travel with the row so that
  // every source stays reachable and so that closing the row closes all of them.
  const merged = new Map<string, any[]>();
  for (const m of best.values()) {
    const k = postingKey(m.jobs.company, m.jobs.title);
    const list = merged.get(k) ?? [];
    list.push(m);
    merged.set(k, list);
  }

  // כל הכרטיסים הפתוחים, לפני כל סינון. בדיקת הכפילות חייבת לרוץ מול
  // הלוח המלא: אם שאול מסנן לפי מקור, התאומה מהלוח השני נעלמת מהמסך
  // ואיתה הסיבה שהשבב נדלק מלכתחילה. 17.11.2026.
  const dupCards = [...merged.values()]
    .filter((list) => !list.some((m) => appliedIds.has(m.jobs.id)))
    .map((list) => list[0]);

  let picked = [...merged.values()]
    // Applied to through any one of its boards means applied to, full stop.
    .filter((list) => !list.some((m) => appliedIds.has(m.jobs.id)))
    .map((list) => {
      // A direct posting leads the row: applying on the company's own site
      // beats applying through whichever agency also listed it.
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
  // cv_id already classifies the posting: the CV that scored it highest is the
  // job family it belongs to, so no second taxonomy is needed.
  // המאגר שהצ'יפים סופרים: אחרי שהוסרו מה שהוגש ומה שנסגר ואחרי הקיבוץ,
  // ולפני בחירת המשפחה, כי כל צ'יפ צריך לדעת כמה יש בו ולא כמה יש בנבחר.
  //
  // 2.11.2026: קודם הם נספרו מתוך תוצאת השאילתה, לפני סינון ההגשות. התוצאה
  // הייתה "הכל 15" מעל רשימה ריקה, מיד אחרי ששאול סימן את כולן כהוגשו, וזה
  // נקרא כאילו משרות שהגיש חזרו.
  const family = picked;
  if (role) picked = picked.filter((m) => m.cv_id === role);

  // Which boards the rows on screen came from, counted per board. A row that
  // three boards listed counts once under each of them, because the question
  // the filter answers is "show me what this board brought", and that job is
  // one of the things it brought.
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

  // 10.11.2026: "ידני" לא מתאר כלום אחרי ששאול ביקש שזה ירוץ לבד. מה
  // שהוא רצה להבדיל הוא חמשת התפקידים שלו מול כל השאר, ולכן השבב מסנן
  // לפיהם. הדגל manual נשאר על משרות ישנות ונספר גם הוא, כדי שלא ייעלמו.
  const coreCount = picked.filter((m) => isCore(m) || m.copies.some((c: any) => c.jobs.manual)).length;
  if (onlyManual) {
    picked = picked.filter((m) => isCore(m) || m.copies.some((c: any) => c.jobs.manual));
  }
  if (source) picked = picked.filter((m) => sourcesOf(m).includes(source));
  // No cut. A day is a day; truncating it just hides the tail.
  const rows = picked;
  const goldKeys = await goldKeySet(sb, rows.flatMap((m: any) => m.copies.map((c: any) => companyKey(c.jobs.company))));

  // Every copy of every row on screen, so that closing the set closes the
  // duplicates too rather than leaving them to come back under another board.
  const allIds = rows.flatMap((m) => m.copies.map((c: any) => c.jobs.id as string));

  // Which rows already have a tailored CV waiting, in one lookup. Without it
  // the only way to find a finished CV is to open every row. The table arrives
  // with migration 0005, so a missing one reads as "none" instead of taking
  // the screen down.
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

  // Who Shaul already knows at the companies on this screen. One query for the
  // whole feed, not one per row: at three hundred rows that is three hundred
  // round trips for what is a lookup.
  const keys = [...new Set(rows.map((m) => companyKey(m.jobs.company)).filter(Boolean))];
  const warm = new Map<string, WarmContact[]>();
  if (keys.length > 0) {
    const select = 'id, full_name, title, linkedin_url, email, phone, contacted_at, company_key';
    // Past a certain width the `in` list stops fitting in a url, so the whole
    // table comes over instead and the filtering happens here. A personal
    // network is a few thousand rows at most.
    const contacts = await contactsByCompanyKeys(sb, keys, select);

    const wanted = new Set(keys);
    for (const c of contacts as any[]) {
      if (!c.company_key || !wanted.has(c.company_key)) continue;
      const list = warm.get(c.company_key) ?? [];
      list.push(c);
      warm.set(c.company_key, list);
    }
  }

  const counts = family.reduce<Record<string, number>>((acc, m) => {
    acc[m.cv_id] = (acc[m.cv_id] ?? 0) + 1;
    return acc;
  }, {});
  const window_ = showAll ? '/jobs?all=1' : `/jobs?days=${days}`;
  // Each row of chips changes its own dimension and keeps the other two, so
  // picking a board does not silently throw away the role you were looking at.
  const base = window_ + (source ? `&source=${encodeURIComponent(source)}` : '');
  const sourceBase = window_ + (role ? `&role=${role}` : '');
  const ROLES: [string, string][] = [
    ['', 'הכל'], ['qa', 'QA'], ['program', 'ניהול פרויקטים'], ['delivery', 'גרסאות ו‑Delivery'],
  ];

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

      <div className="filters">
        {ROLES.map(([id, label]) => (
          <a
            key={id}
            href={id ? `${base}&role=${id}` : base}
            className={'filter' + (role === id ? ' on' : '')}
          >
            {label}
            <span className="n">{id ? (counts[id] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)}</span>
          </a>
        ))}
      </div>

      {/* Shown even for a single source. Hiding the row on a one-board day was
          hiding the only way to reach "close all of them", on exactly the day
          when one board is responsible for the whole screen. */}
      {SOURCES.length > 0 && (
        <div className="filters">
          {(SOURCES.length > 1 || coreCount > 0) && (
            <a href={sourceBase} className={'filter' + (source || onlyManual ? '' : ' on')}>
              כל המקורות
              <span className="n">{Object.values(sourceCounts).reduce((a, b) => a + b, 0)}</span>
            </a>
          )}
          {/* החיפוש הידני. נפרד מהמקורות, כי משרה שנמצאה בו עדיין שייכת
              ללוח שממנו הגיעה. */}
          {coreCount > 0 && (
            <a
              href={onlyManual ? sourceBase : `${sourceBase}&manual=1`}
              className={'filter' + (onlyManual ? ' on' : '')}
            >
              ידני
              <span className="n">{coreCount}</span>
            </a>
          )}
          {SOURCES.map(([src, n]) => (
            // A selected chip clears itself, so one chip is still a working
            // toggle when there is no "all sources" chip to go back to.
            <a
              key={src}
              href={source === src ? sourceBase : `${sourceBase}&source=${encodeURIComponent(src)}`}
              className={'filter' + (source === src ? ' on' : '')}
            >
              {src}
              <span className="n">{n}</span>
            </a>
          ))}
        </div>
      )}

      {source && (
        <p className="screen-note">
          מסונן למקור <b>{source}</b> · <Link href={sourceBase}>כל המקורות ←</Link>
        </p>
      )}

      {/* Only under a filter. On the unfiltered feed this would be a button
          that empties the screen, which is not a thing to put one tap away. */}
      {source && rows.length > 0 && (
        <div className="scanbar">
          <DismissAll ids={allIds} label={source} />
        </div>
      )}

      <p className="screen-note">
        {showAll
          ? 'כל המשרות במאגר, כולל ישנות ולא רלוונטיות.'
          : `נמצאו ${days === 1 ? 'היום' : `ב־${days} הימים האחרונים`} ולא הגשת אליהן. משרה שסגרת ב־✕ לא חוזרת.`}
        {' '}מסודר מהחדש לישן לפי מועד הכניסה למערכת.
        {rows.length > 0 && (() => {
          const t = (m: any) => new Date(m.jobs.first_seen).getTime();
          const ago = (ms: number) => { const h = Math.max(0, Math.round((Date.now() - ms) / 36e5)); return h < 48 ? `לפני ${h} שעות` : `לפני ${Math.round(h / 24)} ימים`; };
          return ` מוצגות ${rows.length}: הכי חדשה ${ago(t(rows[0]))}, הכי ישנה ${ago(t(rows[rows.length - 1]))}.`;
        })()}
        {(role || source || onlyManual) && ` סינון פעיל: ${[role && `משפחה ${role}`, source && `מקור ${source}`, onlyManual && 'חיפוש ידני'].filter(Boolean).join(' · ')}.`}
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          <b>אין משרות חדשות בחלון הזה</b>
          נסה חלון רחב יותר, או בדוק במסך המקורות איזה מקור הפסיק להחזיר.
        </div>
      ) : (
        <div className="rows">
          {rows.map((m) => {
            const j = m.jobs;
            const why: string[] = (m.reasons ?? []).slice(0, 2);
            const flags: string[] = (m.red_flags ?? []).filter(
              (f: string) => !f.includes('אין תיאור')
            );
            return (
              <div className="row job" key={j.id}>
                <span className="grow">
                  {j.title}
                  <span className="sub">
                    {[j.company, j.location].filter(Boolean).join(' · ')}
                  </span>
                  {(
                    <span className="why">
                      {/* 15.11.2026: "יש לי תחושה שהגשתי כבר למשרות האלו".
                          ראשון בשורה, כי זה הדבר שמשנה אם בכלל להסתכל על
                          השאר. לקריאה בלבד. */}
                      <PriorApplied prior={priorApplication(priorIdx, j)} />
                      {/* 10.11.2026: משרה שהחיפוש הידני מצא מסומנת ככזאת,
                          לפי בקשת שאול. הדגל נוסף על המקור ולא מחליף אותו:
                          היא באמת הגיעה מלינקדאין. */}
                      {/* התפקיד שהחיפוש שלו הביא את המשרה. שאול ביקש
                          להבדיל בין מה שהוא מחפש לבין מה שהמערכת גוררת. */}
                      {/* "ידני" ושם התפקיד הם שני דברים שונים, ושניהם
                          מוצגים. קודם הוצג רק אחד מהם, ולכן משרה שהגיעה
                          מהחיפוש הממוקד הראתה את שם התפקיד ולא את התג. */}
                      {m.copies.some((c: any) => c.jobs.manual) && (
                        <span className="chip warn">ידני</span>
                      )}
                      {m.copies.some((c: any) => goldKeys.has(companyKey(c.jobs.company))) && (
                        <span className="chip gold-chip">חברות זהב</span>
                      )}
                      {/* 17.11.2026: הוסר. ראה ההסבר ב-src/app/page.tsx. */}
                      {(() => {
                        const found = m.copies
                          .map((c: any) => c.jobs.found_for)
                          .find(Boolean);
                        if (!found) return null;
                        return <span className={'chip ' + (isCore(m) ? 'ok' : 'mute')}>{found}</span>;
                      })()}
                      {[...new Set(m.copies.map((c: any) => c.jobs.source))].map((src) => (
                        <span className="chip src" key={src as string}>{src as string}</span>
                      ))}
                      {(() => {
                        const a = jobAge(j.posted, j.first_seen);
                        return a ? <span className={`chip age ${a.tone}`}>{a.label}</span> : null;
                      })()}
                      {(() => {
                        const rj = m.copies.map((c: any) => c.jobs).find((x: any) => x.recruiter_url);
                        return rj ? (
                          <a className="chip ok" href={rj.recruiter_url} target="_blank" rel="noreferrer">
                            מפרסם: {rj.recruiter_name || 'פתח פרופיל'}
                          </a>
                        ) : null;
                      })()}
                      {why.map((r) => <span className="chip ok" key={r}>{r}</span>)}
                      {flags.slice(0, 1).map((f) => <span className="chip crit" key={f}>{f}</span>)}
                      <span className="chip mute">{m.cv_id}</span>
                    </span>
                  )}
                </span>
                <div className="cn-flow job-acts">
                {(() => {
                  const t = applyTarget(j);
                  return t ? (
                    <a
                      className={'apply' + (t.indirect ? ' indirect' : '')}
                      href={t.href} target="_blank" rel="noreferrer"
                      title={t.indirect ? 'המקור חסום מאחורי הרשמה, פותח חיפוש למשרה הזו' : undefined}
                    >
                      {t.label}
                    </a>
                  ) : null;
                })()}
                {directLinks(j).map((d) => (
                  <span key={d.label} style={{ display: 'contents' }}>
                  <a
                    className="apply indirect"
                    href={d.href} target="_blank" rel="noreferrer"
                  >
                    {d.label}
                  </a>
                  {d.label === 'מגייסים' && <CopyNote text={connectNote(j.title, j.company)} />}
                  </span>
                ))}
                <CopyGeneric
                  text={goldGenericMessage(j.company, { title: j.title, url: j.url, foundFor: j.found_for }, m.cv_id)}
                  file={cvFileFor(m.cv_id, j.title)} jobId={j.id}
                />
                <MarkApplied id={j.id} cvId={m.cv_id} />
                <MarkApplied id={j.id} cvId={m.cv_id} internal />
                <MarkClosed id={j.id} ids={m.copies.map((c: any) => c.jobs.id)} />
                <Dismiss id={j.id} ids={m.copies.map((c: any) => c.jobs.id)} />
                <DuplicateCheck
                  title={j.title}
                  candidates={duplicateCandidates(dupCards, m)}
                />
                <JobContacts
                  contacts={warm.get(companyKey(j.company)) ?? []}
                  job={{ company: j.company, title: j.title, cvId: m.cv_id,
                         url: j.url, foundFor: j.found_for }}
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
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
