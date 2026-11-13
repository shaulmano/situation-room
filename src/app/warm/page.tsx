import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { applyTarget } from '@/lib/apply';
import { jobAge } from '@/lib/age';
import { companyKey, contactsByCompanyKeys, type WarmContact } from '@/lib/contacts';
import { postingKey } from '@/lib/dedupe';
import Dismiss from '@/components/Dismiss';
import JobContacts from '@/components/JobContacts';
import MarkApplied from '@/components/MarkApplied';
import LinkedinQueue from '@/components/LinkedinQueue';
import PosterQueue, { type PosterRow } from '@/components/PosterQueue';
import Refresh from '@/components/Refresh';
import WarmPicker, { type Pick } from '@/components/WarmPicker';

export const dynamic = 'force-dynamic';

// המסך הזה נולד ממדידה, 12.11.2026.
//
// 540 הגשות, 22 נפתחו על ידי מגייס, 2 הגיעו לשיחה. זה 0.4%. ובאותו זמן
// יש 771 משרות על המטרה שפתוחות ולא הוגש אליהן, מהן רק 13 מהשבוע האחרון:
// זאת ערימה, לא זרם. כלומר הצוואר אינו מציאת משרות אלא המרה.
//
// ולשאול יש 2,657 אנשי קשר מדרגה ראשונה ב-1,760 חברות, ו-382 מהמשרות
// הפתוחות הן בחברה שהוא מכיר בה מישהו. הוא הגיש אליהן קר.
//
// כל מה שצריך כבר היה בקוד, מקופל בתוך <details> מתחת לשורת משרה, במסך
// עם מאות שורות. המסך הזה לא מוסיף יכולת, הוא מוציא אותה החוצה.

export default async function Warm({
  searchParams,
}: {
  searchParams: { all?: string };
}) {
  const sb = serverClient();
  // ברירת המחדל היא מי שעוד לא פנית אליו. "הכל" מראה גם את מי שכבר פנית.
  const showAll = searchParams.all === '1';

  const [{ data: appliedRows }, { data }] = await Promise.all([
    sb.from('applications').select('job_id'),
    sb
      .from('matches')
      .select(
        'score, cv_id, reasons, '
        + 'jobs!inner(id, title, company, source, location, url, first_seen, found_for, '
        + 'posted, on_target, dismissed_at)'
      )
      .eq('jobs.on_target', true)
      .is('jobs.dismissed_at', null)
      .order('first_seen', { ascending: false, referencedTable: 'jobs' })
      .limit(3000),
  ]);

  const appliedIds = new Set((appliedRows ?? []).map((a: any) => a.job_id));

  // ── מי שפרסם משרה שהגשת אליה ───────────────────────────────────────────
  //
  // 13.11.2026. שאול: "על כל שליחה למשרה בלינקדאין אתה תמצא לי את המפרסם
  // ותכניס אותי לשליחת הודעה פרטית".
  //
  // רק הגשות, ורק משרות שיש להן מפרסם. אין מילוי אחורה: משרה שהוגשה לפני
  // שהעמודות נוספו תקבל מפרסם רק אם poster.py יגיע אליה, והוא רץ על שבוע
  // אחורה בלבד.
  const { data: postedRows } = await sb
    .from('applications')
    .select(
      'job_id, cv_id, sent_at, '
      + 'jobs!inner(id, title, company, url, found_for, recruiter_name, recruiter_url, '
      + 'poster_sent_at, poster_replied_at, poster_skipped_at)'
    )
    .not('jobs.recruiter_name', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(200);

  // האם שאול מחובר למפרסם. זה קובע איזו הודעה מוצגת: למחובר הודעה עם
  // קובץ, ולמי שלא פתק בבקשת חברות בלי קובץ. נשאל רק על המפרסמים שעל
  // המסך ולא על כל אנשי הקשר: משיכה של 2,657 שורות בכל רינדור היא בדיוק
  // מה שרוקן את תקציב ה-IO ב-12.11.
  const slugOf = (u?: string | null) =>
    ((u ?? '').match(/\/in\/([A-Za-z0-9\-_%]+)/)?.[1] ?? '').toLowerCase();
  const posterSlugs = [...new Set(
    (postedRows ?? []).map((a: any) => slugOf(a.jobs?.recruiter_url)).filter(Boolean)
  )];
  const { data: knownPosters } = posterSlugs.length
    ? await sb.from('contacts').select('linkedin_url')
        .or(posterSlugs.map((s) => `linkedin_url.ilike.%/in/${s}%`).join(','))
    : { data: [] as any[] };
  const knownSlugs = new Set(
    (knownPosters ?? []).map((c: any) => slugOf(c.linkedin_url)).filter(Boolean)
  );

  const posters: PosterRow[] = (postedRows ?? [])
    .map((a: any) => ({
      jobId: a.jobs.id,
      title: a.jobs.title,
      company: a.jobs.company ?? '',
      cvId: a.cv_id ?? null,
      foundFor: a.jobs.found_for ?? null,
      url: a.jobs.url ?? null,
      posterName: a.jobs.recruiter_name as string,
      posterUrl: a.jobs.recruiter_url as string,
      connected: knownSlugs.has(slugOf(a.jobs.recruiter_url)),
      appliedAt: a.sent_at ?? null,
      sentAt: a.jobs.poster_sent_at ?? null,
      repliedAt: a.jobs.poster_replied_at ?? null,
      skippedAt: a.jobs.poster_skipped_at ?? null,
    }))
    .filter((r: PosterRow) => r.posterUrl);

  // שורה אחת למשרה, הגרסה שקיבלה את הניקוד הגבוה ביותר.
  const best = new Map<string, any>();
  for (const m of (data ?? []) as any[]) {
    const id = m.jobs?.id;
    if (!id) continue;
    if (!best.has(id) || best.get(id).score < m.score) best.set(id, m);
  }

  // ואז שורה אחת לפרסום, כי אותה משרה מופיעה בכמה לוחות.
  const merged = new Map<string, any[]>();
  for (const m of best.values()) {
    const k = postingKey(m.jobs.company, m.jobs.title);
    const list = merged.get(k) ?? [];
    list.push(m);
    merged.set(k, list);
  }

  const postings = [...merged.values()]
    .filter((list) => !list.some((m) => appliedIds.has(m.jobs.id)))
    .map((list) => {
      const order = [...list].sort((a, b) => {
        const indirect = (m: any) => (applyTarget(m.jobs)?.indirect ? 1 : 0);
        return indirect(a) - indirect(b)
          || new Date(b.jobs.first_seen).getTime() - new Date(a.jobs.first_seen).getTime();
      });
      return { ...order[0], copies: order };
    });

  // אנשי הקשר, לפי אותו מפתח חברה שמשמש בייבוא. בלעדיו "Qmarkets Ltd."
  // ו-"Qmarkets" הן שתי חברות.
  const keys = [...new Set(postings.map((m) => companyKey(m.jobs.company)).filter(Boolean))];
  const select = 'id, full_name, title, company_key, linkedin_url, email, phone, contacted_at, replied_at, skipped_at';
  const contacts = await contactsByCompanyKeys(sb, keys, select);

  // 12.11.2026. מפתח ריק אינו התאמה. 81 משרות פתוחות הגיעו בלי שם חברה,
  // ול-4 אנשי קשר אין שם חברה בייבוא, ושני הצדדים נורמלו לאותה מחרוזת
  // ריקה. התוצאה: ארבעת האנשים הותאמו לכל 81 המשרות, וזה היה רוב הרשימה
  // על המסך. מי שאין לו שם חברה לא מתאים לאף אחד, בשני הכיוונים.
  const warm = new Map<string, WarmContact[]>();
  for (const c of contacts as any[]) {
    const k = (c.company_key ?? '').trim();
    if (!k) continue;
    const list = warm.get(k) ?? [];
    list.push(c);
    warm.set(k, list);
  }

  const withContacts = postings
    .map((m) => {
      const k = companyKey(m.jobs.company);
      return { m, people: k ? warm.get(k) ?? [] : [] };
    })
    .filter((r) => r.people.length > 0);

  // התור: מה שכבר סומן לשליחה, כדי שהמסך ידע מה מצבו ולא יציע אותו שוב.
  // 12.11.2026: גם הנוסח וגם מצב הקובץ, כי הבדיקה עברה מהמייל למסך.
  // pdf_base64 עצמו לא נשלף: הוא מאות אלפי תווים, והמסך צריך רק לדעת
  // אם הוא קיים. הקובץ עצמו נמשך לפי דרישה מ-/api/outreach/cv.
  const { data: queued } = await sb
    .from('referrals')
    .select('id, contact_id, job_id, cv_id, status, subject, body');

  // 13.11.2026: הקובץ נקרא גם מ-cv_requests, ולא רק מההעתקה שבשורת
  // הפנייה. ההעתקה הזאת נעשית בתוך השולח, שרץ רק אחרי שהפנייה אושרה,
  // ולכן נוצר מעגל: הקובץ חיכה לאישור והאישור חיכה לקובץ. שלוש פניות
  // הציגו "קורות החיים עוד נוצרים" בזמן שהקובץ היה מוכן שעות קודם.
  // 13.11.2026: הקובץ המצורף הוא קובץ הבסיס של שאול לפי משפחת
  // התפקידים, ולא הגרסה שהמחולל כתב למשרה. לכן "מוכן לשליחה" נמדד מול
  // טבלת הגרסאות, לא מול תור הייצור. קודם זה נמדד מול cv_requests,
  // וזה היה חוסם שליחה כשקובץ הבסיס היה מוכן מזמן.
  const { data: cvFiles } = await sb
    .from('cvs')
    .select('id, filename, pdf_base64')
    .not('pdf_base64', 'is', null);
  const haveFile = new Map<string, string>();
  for (const c of (cvFiles ?? []) as any[]) haveFile.set(c.id, c.filename);

  const queuedBy = new Map<string, any>();
  for (const q of (queued ?? []) as any[]) {
    const name = haveFile.get(q.cv_id ?? 'qa') ?? haveFile.get('qa');
    queuedBy.set(`${q.contact_id}|${q.job_id}`, {
      id: q.id, status: q.status, subject: q.subject, body: q.body,
      filename: name ?? null,
      cvReady: !!name,
    });
  }

  // שורה אחת לאדם, לא שורה לכל צמד איש־משרה.
  //
  // 12.11.2026. מאחורי עשרים הפניות שהמסך הציע עמדו חמישה אנשים: כל אחד
  // הופיע על שלוש־ארבע משרות באותה חברה. "סמן הכל" היה שולח לאותו אדם
  // ארבעה מיילים נפרדים בתוך כמה שעות, וזה מה שהורג ערוץ חם. שאול בחר
  // מייל אחד לאדם, על המשרה שקיבלה את הניקוד הגבוה ביותר אצלו.
  //
  // שורה שכבר בתור גוברת על הבחירה הזאת, אחרת סימון שכבר יצא היה נעלם
  // מהמסך ברגע שמשרה חדשה יותר נכנסה לאותה חברה.
  const byContact = new Map<string, Pick>();
  for (const { m, people } of withContacts) {
    for (const c of people) {
      const pick: Pick = {
        contact: c,
        job: {
          id: m.jobs.id, title: m.jobs.title,
          company: m.jobs.company, cvId: m.cv_id ?? null,
          foundFor: m.jobs.found_for ?? null,
          url: m.jobs.url ?? null,
        },
        queued: queuedBy.get(`${c.id}|${m.jobs.id}`) ?? null,
        score: m.score ?? 0,
      };
      const prev = byContact.get(c.id);
      if (!prev) { byContact.set(c.id, pick); continue; }
      if (prev.queued) continue;
      if (pick.queued || pick.score > prev.score) byContact.set(c.id, pick);
    }
  }
  const picks: Pick[] = [...byContact.values()];

  const freshCount = withContacts.filter(
    (r) => !r.people.every((p) => p.contacted_at)
  ).length;

  const rows = (showAll
    ? withContacts
    : withContacts.filter((r) => !r.people.every((p) => p.contacted_at))
  ).sort((a, b) => {
    // מי שיש בו יותר אנשים שעוד לא פנית אליהם קודם, ואז המשרה החדשה יותר.
    const open = (r: typeof a) => r.people.filter((p) => !p.contacted_at).length;
    return open(b) - open(a)
      || new Date(b.m.jobs.first_seen).getTime() - new Date(a.m.jobs.first_seen).getTime();
  });

  return (
    <main>
      <h2>דרך מישהו שאתה מכיר</h2>

      <p className="screen-note">
        ‏540 הגשות קרות הביאו 22 פתיחות ושתי שיחות. המשרות כאן הן בחברות שאתה
        מכיר בהן מישהו אישית, ולכן הן לא עוד הגשה בערימה. הפנייה נכתבת כאן,
        ההודעה מוכנה להעתקה, והשליחה היא שלך.
      </p>

      <Refresh />

      <WarmPicker picks={picks} />

      <LinkedinQueue picks={picks} />

      <PosterQueue rows={posters} />

      <div className="filters">
        <Link href="/warm" className={'filter' + (showAll ? '' : ' on')}>
          שלא פנית
          <span className="n">{freshCount}</span>
        </Link>
        <Link href="/warm?all=1" className={'filter' + (showAll ? ' on' : '')}>
          הכל
          <span className="n">{withContacts.length}</span>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <strong>{withContacts.length === 0 ? 'אין כרגע משרה בחברה שאתה מכיר בה מישהו' : 'פנית לכולם'}</strong>
          <span>
            {withContacts.length === 0
              ? 'ברגע שתיכנס משרה בחברה כזאת היא תופיע כאן.'
              : 'אפשר לראות את מי שכבר פנית אליו בלשונית "הכל".'}
          </span>
        </div>
      ) : (
        <div className="rows">
          {rows.map(({ m, people }) => {
            const j = m.jobs;
            const open = people.filter((p) => !p.contacted_at).length;
            const t = applyTarget(j);
            return (
              <div className="row job" key={j.id}>
                <span className="grow">
                  {j.title}
                  <span className="sub">
                    {[j.company, j.location].filter(Boolean).join(' · ')}
                  </span>
                  <span className="why">
                    <span className="chip ok">
                      {open > 0
                        ? `${open} ${open === 1 ? 'מכר' : 'מכרים'} שלא פנית`
                        : 'פנית לכולם'}
                    </span>
                    {(() => {
                      const a = jobAge(j.posted, j.first_seen);
                      return a ? <span className={'chip ' + a.tone}>{a.label}</span> : null;
                    })()}
                    <span className="chip src">{j.source}</span>
                  </span>
                </span>

                {t && (
                  <a
                    className={'apply' + (t.indirect ? ' indirect' : '')}
                    href={t.href} target="_blank" rel="noreferrer"
                  >
                    {t.label}
                  </a>
                )}
                <MarkApplied id={j.id} cvId={m.cv_id} />
                <Dismiss id={j.id} ids={m.copies.map((c: any) => c.jobs.id)} noRefresh />

                {/* פתוח כברירת מחדל: כל המסך הזה הוא בדיוק הבלוק הזה, ואין
                    שום סיבה שיצטרך עוד לחיצה כדי להיפתח. */}
                <JobContacts
                  contacts={people}
                  job={{ company: j.company, title: j.title, cvId: m.cv_id,
                         url: j.url, foundFor: j.found_for }}
                  open
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
