import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { applyTarget } from '@/lib/apply';
import { jobAge } from '@/lib/age';
import { companyKey, type WarmContact } from '@/lib/contacts';
import { postingKey } from '@/lib/dedupe';
import Dismiss from '@/components/Dismiss';
import JobContacts from '@/components/JobContacts';
import MarkApplied from '@/components/MarkApplied';

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
        + 'jobs!inner(id, title, company, source, location, url, first_seen, '
        + 'posted, on_target, dismissed_at)'
      )
      .eq('jobs.on_target', true)
      .is('jobs.dismissed_at', null)
      .order('first_seen', { ascending: false, referencedTable: 'jobs' })
      .limit(3000),
  ]);

  const appliedIds = new Set((appliedRows ?? []).map((a: any) => a.job_id));

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
  const select = 'id, full_name, title, company_key, linkedin_url, email, phone, contacted_at';
  const { data: contacts } = keys.length > 120
    ? await sb.from('contacts').select(select).limit(5000)
    : await sb.from('contacts').select(select).in('company_key', keys);

  const warm = new Map<string, WarmContact[]>();
  for (const c of (contacts ?? []) as any[]) {
    const list = warm.get(c.company_key) ?? [];
    list.push(c);
    warm.set(c.company_key, list);
  }

  const withContacts = postings
    .map((m) => ({ m, people: warm.get(companyKey(m.jobs.company)) ?? [] }))
    .filter((r) => r.people.length > 0);

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
                <Dismiss id={j.id} ids={m.copies.map((c: any) => c.jobs.id)} />

                {/* פתוח כברירת מחדל: כל המסך הזה הוא בדיוק הבלוק הזה, ואין
                    שום סיבה שיצטרך עוד לחיצה כדי להיפתח. */}
                <JobContacts
                  contacts={people}
                  job={{ company: j.company, title: j.title, cvId: m.cv_id }}
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
