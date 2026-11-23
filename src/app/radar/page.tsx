import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { jobAge } from '@/lib/age';
import Dismiss from '@/components/Dismiss';
import MarkApplied from '@/components/MarkApplied';
import MarkClosed from '@/components/MarkClosed';
import PriorApplied from '@/components/PriorApplied';
import { loadApplied, priorApplication } from '@/lib/priorApplication';
import { internalApplied } from '@/lib/internalApplied';
import RadarPeople, { type RadarPerson } from '@/components/RadarPeople';
import { companyKey } from '@/lib/contacts';
import { goldConnectNote, goldMessage, loadAliases } from '@/lib/gold';
import { cvFamilyForTitle, cvFileFor } from '@/lib/outreach';

export const dynamic = 'force-dynamic';

// "מתחת לרדאר".
//
// 14.11.2026. שאול שלח את המדריך של ניסן איטל בשם הזה וביקש טאב נפרד.
// המדריך בנוי סביב שאילתת `site:` אחת בגוגל שסורקת את כל פלטפורמות ה-ATS
// יחד, במקום לקרוא לוח אחד אחד מרשימת שמות.
//
// **למה זה מסך נפרד ולא עוד שבב במסך המשרות.** הסורקים הרגילים קוראים 27
// לוחות Greenhouse לפי רשימה קבועה, ולכן הם מוצאים רק את מה שבחברות
// שאנחנו כבר מכירים. באותו ערב שאול שלח משרה ב-Alteva RCM ושאל למה לא
// מצאנו אותה, והתשובה הייתה שהחברה פשוט לא הייתה ברשימה. חיפוש בגוגל אינו
// מוגבל לרשימה, ולכן הוא מביא סוג אחר של תוצאה.
//
// **ושלושה כללים שהוא נתן במפורש, וכולם שונים ממסך המשרות:**
//
// 1. **בלי שער גיל.** "הם ממליצים לעשות חיפוש גם שנה אחורה, וטוענים שאם
//    הן מופיעות בדף החברה הן עדיין קיימות". זה נכון דווקא כאן: בלוח ATS
//    מודעה שנסגרה נעלמת מה-API, ולכן מה שמופיע פתוח בהגדרה.
// 2. **שורה יורדת רק כשהוא סוגר אותה.** "אתה לא מוחק גם אם עברו כמה ימים,
//    רק אני סוגר".
// 3. **ריצה אחת ביום.** "קח בחשבון ריצה אחת ביום לחיפוש".
//
// **והמסך קורא מ-jobs ישירות ולא דרך matches.** זאת בחירה ולא קיצור דרך:
// משרה שנכנסה ל-jobs ואין לה שורת התאמה אינה מוצגת בשום מסך שמצרף אותן,
// בלי שום שגיאה, וזה הפיל כאן את הלוח פעמיים. מסך שהתפקיד שלו הוא להראות
// מה נמצא לא יכול להיות תלוי בכך שהניקוד הצליח.

export default async function Radar({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const sb = serverClient();
  const internalN = await internalApplied(sb);
  const source = searchParams.source ?? '';

  // 15.11.2026: גם הכותרת והחברה. הרדאר מביא מלוחות ATS, ואותה משרה
  // בלינקדאין היא כתובת אחרת, ולכן הסינון לפי מזהה לא תופס אותה.
  const { rows: applied, idx: priorIdx } = await loadApplied(sb);
  const appliedIds = new Set(applied.map((a: any) => a.job_id).filter(Boolean));

  const { data: rows, error } = await sb
    .from('jobs')
    .select('id, title, company, source, location, url, first_seen, posted, found_for, description')
    .eq('seo', true)
    .is('dismissed_at', null)
    .order('first_seen', { ascending: false })
    .limit(500);

  const all = (rows ?? []).filter((j: any) => !appliedIds.has(j.id));

  const counts = all.reduce<Record<string, number>>((acc, j: any) => {
    const s = j.source || 'SEO';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const shown = source ? all.filter((j: any) => (j.source || 'SEO') === source) : all;

  // מי אפשר לפנות בחברה של כל משרה: איש קשר מאומת קודם, ואחריו מגייס שנמצא
  // בחיפוש. בלי אף אחד אין שורה. 23.11.2026, לבקשת שאול. נשאר ברדאר ולא עובר
  // לזהב.
  const aliases = await loadAliases(sb);
  const keyOf = (j: any) => { const k = companyKey(j.company); return k ? (aliases.get(k) ?? k) : ''; };
  const keys = [...new Set(shown.map(keyOf).filter(Boolean))];
  const verifiedBy = new Map<string, any[]>();
  const foundBy = new Map<string, any[]>();
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const { data: vc } = await sb.from('contacts')
      .select('id, full_name, title, linkedin_url, verified_key')
      .eq('verified_ok', true).gte('verified_at', since).is('left_company_at', null)
      .in('verified_key', chunk);
    for (const c of (vc ?? []) as any[]) verifiedBy.set(c.verified_key, [...(verifiedBy.get(c.verified_key) ?? []), c]);
    const { data: cs } = await sb.from('companies').select('id, company_key').in('company_key', chunk);
    const idKey = new Map((cs ?? []).map((c: any) => [c.id, c.company_key]));
    if (idKey.size) {
      const { data: fr } = await sb.from('gold_recruiters')
        .select('id, company_id, full_name, headline, profile_url')
        .in('company_id', [...idKey.keys()]).is('contacted_at', null).is('skipped_at', null);
      for (const f of (fr ?? []) as any[]) {
        const k = idKey.get(f.company_id) as string;
        foundBy.set(k, [...(foundBy.get(k) ?? []), f]);
      }
    }
  }
  const peopleFor = (j: any): RadarPerson[] => {
    const k = keyOf(j);
    const job = { title: j.title, url: j.url, foundFor: j.found_for ?? null };
    const cvId = cvFamilyForTitle(j.title) ?? 'project-release-manager';
    const ver = (verifiedBy.get(k) ?? []).slice(0, 2);
    if (ver.length) {
      return ver.map((c) => ({
        kind: 'contact' as const, id: c.id, name: c.full_name, title: c.title, url: c.linkedin_url, jobId: j.id,
        message: goldMessage({ contactName: c.full_name, contactTitle: c.title, company: j.company, job, cvId }),
        cvFile: cvFileFor(cvId, j.title),
      }));
    }
    return (foundBy.get(k) ?? []).slice(0, 2).map((f) => ({
      kind: 'find' as const, id: f.id, name: f.full_name, title: f.headline, url: f.profile_url, jobId: j.id,
      message: goldConnectNote({ name: f.full_name, company: j.company, jobTitle: j.title }),
    }));
  };

  return (
    <main>
      <div className="head">
        <h1>מתחת לרדאר</h1>
        <Link className="more" href="/">← חדר המצב</Link>
      </div>

      <p className="sub">
        חיפוש בוליאני אחד בגוגל על פני כל פלטפורמות הגיוס, פעם ביום. אלה משרות
        שיושבות בעמוד הקריירה של החברה ולא הגיעו לשום לוח, ולכן הסריקה הרגילה
        לא יכלה למצוא אותן.
        {' '}הוגשו פנימית: <b>{internalN.today}</b> היום, <b>{internalN.week}</b> בשבוע, <b>{internalN.total}</b> בסך הכל.
      </p>

      {error && (
        <div className="alert">
          שגיאה בשליפה: {error.message}
        </div>
      )}

      {!error && all.length === 0 && (
        <div className="empty">
          <b>עדיין ריק.</b> החיפוש רץ פעם ביום. אם זה נמשך יומיים, זה לא שקט
          בשוק אלא תקלה, ושווה להגיד לי.
        </div>
      )}

      {all.length > 0 && (
        <div className="chips">
          <Link className={`chip ${source ? '' : 'on'}`} href="/radar">
            הכל {all.length}
          </Link>
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => (
              <Link
                key={s}
                className={`chip ${source === s ? 'on' : ''}`}
                href={`/radar?source=${encodeURIComponent(s)}`}
              >
                {s} {n}
              </Link>
            ))}
        </div>
      )}

      <div className="list">
        {shown.map((j: any) => {
          const age = jobAge(j.posted ?? null, j.first_seen ?? null);
          return (
            <div className="row" key={j.id}>
              <div className="rowtop">
                <a className="title" href={j.url} target="_blank" rel="noreferrer">
                  {j.title}
                </a>
                <Dismiss id={j.id} />
              </div>

              <div className="meta">
                {j.company && <b>{j.company}</b>}
                {j.location ? ` · ${j.location}` : ''}
                <span className="chip mute">{j.source || 'SEO'}</span>
                {j.found_for && <span className="chip mute">{j.found_for}</span>}
                {j.recruiter_url && (
                  <a className="chip ok" href={j.recruiter_url} target="_blank" rel="noreferrer">
                    מפרסם: {j.recruiter_name || 'פתח פרופיל'}
                  </a>
                )}
                <PriorApplied prior={priorApplication(priorIdx, j)} />
                {/* הגיל מוצג ולא מסנן. שאול מחליט, לא השער. */}
                {age && <span className={`chip age-${age.tone}`}>{age.label}</span>}
              </div>

              <RadarPeople people={peopleFor(j)} />

              <div className="actions">
                <a className="apply" href={j.url} target="_blank" rel="noreferrer">
                  לעמוד המשרה
                </a>
                <MarkApplied id={j.id} />
                <MarkApplied id={j.id} internal />
                <MarkClosed id={j.id} />
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        main { padding: 12px 14px 40px; max-width: 760px; margin: 0 auto; }
        .head { display: flex; align-items: baseline; justify-content: space-between;
                gap: 10px; flex-wrap: wrap; }
        h1 { font-size: 1.25rem; margin: 0 0 2px; }
        .sub { color: var(--muted); font-size: .8rem; line-height: 1.5; margin: 6px 0 14px; }
        .alert { background: color-mix(in srgb, var(--bad) 14%, var(--surface));
                 border: 1px solid var(--bad); border-radius: 8px; padding: 10px;
                 font-size: .85rem; margin-bottom: 12px; }
        .empty { background: var(--raised); border: 1px solid var(--hair);
                 border-radius: 8px; padding: 14px; font-size: .85rem;
                 line-height: 1.6; color: var(--muted); }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .chip { font-size: .72rem; padding: .25em .6em; border-radius: 999px;
                border: 1px solid var(--hair); background: var(--raised);
                color: var(--muted); white-space: nowrap; }
        .chip.on { background: var(--accent); color: #fff; border-color: var(--accent); }
        .list { display: flex; flex-direction: column; gap: 8px; }
        .row { background: var(--surface); border: 1px solid var(--hair);
               border-radius: 8px; padding: 10px; }
        .rowtop { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .title { font-weight: 700; font-size: .92rem; line-height: 1.35; }
        .meta { color: var(--muted); font-size: .76rem; margin-top: 4px;
                display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .apply { font-size: .78rem; font-weight: 700; padding: .45em .9em;
                 border-radius: 6px; background: var(--accent); color: #fff; }
        /* 390 פיקסלים: הכפתורים לא נדחסים לשורה אחת צרה. */
        @media (max-width: 420px) {
          .actions > * { flex: 1 1 auto; text-align: center; }
        }
      `}</style>
    </main>
  );
}
