import Link from 'next/link';
import { serverClient } from '@/lib/server';
import GoldList, { type GoldRow } from '@/components/GoldList';
import { companyKey, peopleAtCompanyHref, type WarmContact } from '@/lib/contacts';
import { rankContacts, isAgency } from '@/lib/pickContact';
import { cvFamilyForTitle, cvFileFor } from '@/lib/outreach';
import { israelDayStart, WIDE_CV_FILE } from '@/lib/wideReach';
import { loadApplied } from '@/lib/priorApplication';
import { GOLD_DAILY, GOLD_QUOTA, goldMessage, goldRank, type GoldCompany } from '@/lib/gold';

export const dynamic = 'force-dynamic';

/**
 * חברות זהב: המסך העיקרי.
 *
 * 20.11.2026, שאול: "הפוקוס עובר לקובץ כל יום". הגשה רק דרך מי שעובד שם.
 * **השלב הראשון הוא מכרים בלבד**: כל יום 40 החברות שיש בהן הכי הרבה
 * אנשי קשר שלו, גוש דן קודם. הסריקות והמסכים האחרים לא נגעו.
 *
 * אותה משרה פתוחה בחברה מוצגת ליד אנשי הקשר, ואז ההודעה היא הנוסח של
 * הפניות דרך מכרים. אין משרה: הודעה כללית עם קורות החיים.
 * מקור החברות: techmap (רשם החברות, ODbL).
 */
export default async function Gold() {
  const sb = serverClient();

  const { data: cs, error } = await sb.from('contacts')
    .select('id, full_name, title, company, company_key, linkedin_url, email, phone, contacted_at, gold_skipped_at')
    .is('gold_skipped_at', null)
    .is('left_company_at', null)
    .not('company_key', 'is', null)
    .not('linkedin_url', 'is', null)
    .limit(5000);
  if (error) {
    return (
      <main>
        <div className="head"><h1>חברות זהב</h1><Link className="more" href="/">← חדר המצב</Link></div>
        <div className="alert">שגיאה בשליפה: {error.message}</div>
      </main>
    );
  }

  const byKey = new Map<string, WarmContact[]>();
  for (const c of (cs ?? []) as any[]) {
    if (!c.company_key) continue;
    const arr = byKey.get(c.company_key) ?? [];
    arr.push(c as WarmContact);
    byKey.set(c.company_key, arr);
  }

  // משרות פתוחות, בלי מה שכבר הוגש. נשלפות לפני הבחירה, כי חברה שיש בה
  // משרה פתוחה ומכר שלך נכנסת לתור של היום מעל המכסה, ראשונה.
  const { rows: applied } = await loadApplied(sb);
  const appliedIds = new Set(applied.map((a: any) => a.job_id).filter(Boolean));
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: jobsRaw } = await sb.from('jobs')
    .select('id, title, company, url, source, found_for, first_seen, live_checked_at')
    .eq('on_target', true)
    // ✕ במסכים הרגילים לא מוריד משרה מכאן (שאול, 20.11.2026: "שלא תוריד").
    // הוא לא מגיש מהמשרה אלא דרך מכר, ולכן סגירה שם אינה סגירה כאן.
    // מה שמוריד אותה: אימות שנסגרה, או "מוותר" על החברה.
    .is('closed_at', null)
    .gte('first_seen', since)
    .order('first_seen', { ascending: false })
    .limit(4000);
  const fresh = Date.now() - 48 * 3600 * 1000;
  const isVerified = (j: any) => !!j.live_checked_at && new Date(j.live_checked_at).getTime() >= fresh;
  const jobsByKey = new Map<string, any[]>();
  for (const j of (jobsRaw ?? []) as any[]) {
    if (appliedIds.has(j.id)) continue;
    // **חד חד ערכי** (שאול, 20.11.2026: "עוד משרה שלא קיימת יותר"). משרה
    // מוצגת כאן רק אם אומתה כפתוחה בשעות האחרונות. לא אומתה: לא מוצגת.
    if (!isVerified(j)) continue;
    const k = companyKey(j.company);
    if (!k) continue;
    const arr = jobsByKey.get(k) ?? [];
    arr.push(j);
    jobsByKey.set(k, arr);
  }
  // **"משרה פתוחה" רק אם אומתה.** 20.11.2026 שאול הראה את Fetcherr:
  // לינקדאין אמרה "No longer accepting applications" והמסך הציג אותה
  // כמשרה פתוחה בצבע בולט. עכשיו הקפצה דורשת אימות מהשעות האחרונות,
  // ומשרה שלא אומתה אינה מוצגת בכלל.
  const hotKeys = [...jobsByKey.entries()]
    .filter(([, js]) => js.some(isVerified))
    .map(([k]) => k);
  const hotIds: string[] = [];
  for (let i = 0; i < hotKeys.length; i += 100) {
    const { data: hc } = await sb.from('companies').select('id')
      .in('company_key', hotKeys.slice(i, i + 100))
      .eq('region', 'gush_dan')
      .is('gold_done_at', null)
      .is('gold_skipped_at', null);
    hotIds.push(...((hc ?? []) as any[]).map((r) => r.id));
  }
  const hotSet = new Set(hotIds);

  // המאגר כולו, בלי מה שכבר הוחלט עליו. נשלף בעמודים, כי PostgREST מגביל
  // שורות לשליפה. רק מה שנדרש לדירוג, ואת הפרטים שולפים רק ל-50 שנבחרו.
  const day = israelDayStart().slice(0, 10);
  const dayStart = israelDayStart();
  const pickedIds: string[] = [...hotIds];
  const decidedBy: Record<string, number> = { S: 0, M: 0, E: 0 };
  for (const cls of ['S', 'M', 'E'] as const) {
    const [d1, d2] = await Promise.all([
      sb.from('companies').select('id', { count: 'exact', head: true })
        .eq('size_class', cls).gte('gold_done_at', dayStart),
      sb.from('companies').select('id', { count: 'exact', head: true })
        .eq('size_class', cls).gte('gold_skipped_at', dayStart),
    ]);
    decidedBy[cls] = (d1.count ?? 0) + (d2.count ?? 0);
    const slots = Math.max(0, GOLD_QUOTA[cls] - decidedBy[cls]);
    if (!slots) continue;
    const pool: { id: string; n: number; gush: boolean }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: pe } = await sb.from('companies')
        .select('id, company_key, region')
        .eq('size_class', cls)
        .eq('region', 'gush_dan')
        .is('gold_done_at', null)
        .is('gold_skipped_at', null)
        .order('id')
        .range(from, from + 999);
      if (pe) {
        return (
          <main>
            <div className="head"><h1>חברות זהב</h1><Link className="more" href="/">← חדר המצב</Link></div>
            <div className="alert">שגיאה בשליפת החברות: {pe.message}</div>
          </main>
        );
      }
      for (const r of (data ?? []) as any[]) {
        if (hotSet.has(r.id)) continue;
        pool.push({ id: r.id, n: r.company_key ? (byKey.get(r.company_key)?.length ?? 0) : 0, gush: r.region === 'gush_dan' });
      }
      if (!data || data.length < 1000) break;
    }
    pool.sort((x, y) => goldRank(x, y, day));
    pickedIds.push(...pool.slice(0, slots).map((x) => x.id));
  }

  const decided = decidedBy.S + decidedBy.M + decidedBy.E;
  const left = Math.max(0, GOLD_DAILY - decided);

  const { data: picked } = pickedIds.length
    ? await sb.from('companies')
        .select('id, name, company_key, size_class, size_range, region, city, website, careers_url, is_hiring')
        .in('id', pickedIds)
    : { data: [] as any[] };
  const classOrder: Record<string, number> = { E: 0, M: 1, S: 2 };
  const ranked = ((picked ?? []) as GoldCompany[])
    .map((c) => ({ c, n: c.company_key ? (byKey.get(c.company_key)?.length ?? 0) : 0 }))
    .sort((x, y) => ((hotSet.has(y.c.id) ? 1 : 0) - (hotSet.has(x.c.id) ? 1 : 0)) || (y.n - x.n)
      || ((x.c.region === 'gush_dan' ? 0 : 1) - (y.c.region === 'gush_dan' ? 0 : 1))
      || ((classOrder[x.c.size_class ?? ''] ?? 3) - (classOrder[y.c.size_class ?? ''] ?? 3)));

  const rows: GoldRow[] = ranked.map(({ c, n }) => {
    const jobs = jobsByKey.get(c.company_key) ?? [];
    const top = jobs[0] ?? null;
    const people = rankContacts(byKey.get(c.company_key) ?? [], top?.title, isAgency(c.name)).slice(0, 3);
    const peopleHref = peopleAtCompanyHref(c.name, null);
    const cvId = top ? (cvFamilyForTitle(top.title) ?? 'project-release-manager') : null;
    return {
      id: c.id,
      hot: hotSet.has(c.id),
      name: c.name,
      sizeRange: c.size_range,
      sizeClass: c.size_class,
      city: c.city,
      gushDan: c.region === 'gush_dan',
      website: c.website,
      careers: c.careers_url,
      hiring: c.is_hiring,
      contactsTotal: n,
      peopleHref,
      cvFile: top ? cvFileFor(cvId, top.title) : WIDE_CV_FILE,
      jobs: jobs.slice(0, 4).map((j) => ({ id: j.id, title: j.title, url: j.url, source: j.source, verified: isVerified(j) })),
      people: people.map((p) => ({
        id: p.id,
        name: p.full_name,
        title: p.title,
        url: p.linkedin_url,
        message: goldMessage({
          contactName: p.full_name,
          contactTitle: p.title,
          company: c.name,
          job: top ? { title: top.title, url: top.url, foundFor: top.found_for } : null,
          cvId,
        }),
      })),
    };
  });

  return (
    <main>
      <div className="head">
        <h1>חברות זהב</h1>
        <Link className="more" href="/">← חדר המצב</Link>
      </div>
      <p className="sub">
        בכל חברה: מכר אם יש, משרה אם ידועה, ואם אין כלום זה כתוב. רק גוש דן בשלב הזה. בכל גודל, מי שיש בה מכר קודם.
        {' '}{GOLD_DAILY} ביום, מכל הגדלים: {GOLD_QUOTA.S} קטנות, {GOLD_QUOTA.M} בינוניות, {GOLD_QUOTA.E} גדולות.
        {hotIds.length > 0 && <> בראש הרשימה, בצבע, <b>{hotIds.length}</b> חברות שיש בהן משרה פתוחה שאומתה, מעל ה-{GOLD_DAILY}.</>}
      </p>
      <GoldList rows={rows} target={GOLD_DAILY} doneToday={decided} />
      <p className="hint" style={{ marginTop: '1.2rem' }}>
        מקור המאגר: techmap, מבוסס על רשם החברות, ברישיון ODbL.
      </p>
    </main>
  );
}
