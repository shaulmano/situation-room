import Link from 'next/link';
import { serverClient } from '@/lib/server';
import { type GoldRow } from '@/components/GoldList';
import GoldSimple from '@/components/GoldSimple';
import { companyKey, peopleAtCompanyHref, type WarmContact } from '@/lib/contacts';
import { rankContacts, isAgency } from '@/lib/pickContact';
import { cvFamilyForTitle, cvFileFor } from '@/lib/outreach';
import { israelDayStart, WIDE_CV_FILE } from '@/lib/wideReach';
import { loadApplied } from '@/lib/priorApplication';
import { GOLD_DAILY, GOLD_QUOTA, goldConnectNote, goldGenericMessage, goldMessage, goldRank, loadAliases, type GoldCompany } from '@/lib/gold';
import { jobPlace, cityOf } from '@/lib/jobLocation';
import { postingKey } from '@/lib/dedupe';
import { internalApplied } from '@/lib/internalApplied';

export const dynamic = 'force-dynamic';

const CORE_ROLES = [
  'QA Director', 'QA Manager', 'Head of QA', 'QA Team Leader',
  'Project Manager', 'Program Manager', 'Release Manager',
];

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

  // PostgREST מחזיר לכל היותר 1000 שורות, ו-`.limit(5000)` לא עוקף את זה.
  // 22.11.2026: Hila Perels (mPrest) ו-Danielle Steinberg (Dream) היו במסד
  // והכרטיס אמר "אין איש קשר", כי הן ישבו מעבר ל-1000 הראשונות. לכן דפים.
  const cs: any[] = [];
  let error: { message: string } | null = null;
  for (let from = 0; from < 8000; from += 1000) {
    const r = await sb.from('contacts')
      .select('id, full_name, title, company, company_key, linkedin_url, email, phone, contacted_at, gold_skipped_at, verified_ok, verified_key, verified_at')
      .is('gold_skipped_at', null)
      .is('left_company_at', null)
      .not('company_key', 'is', null)
      .not('linkedin_url', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (r.error) { error = r.error; break; }
    cs.push(...(r.data ?? []));
    if (!r.data || r.data.length < 1000) break;
  }
  if (error) {
    return (
      <main>
        <div className="head"><h1>חברות זהב</h1><Link className="more" href="/">← חדר המצב</Link></div>
        <div className="alert">שגיאה בשליפה: {error.message}</div>
      </main>
    );
  }

  // כינויים: משלימים התאמה שהשם המדויק מפספס (Scytale מול Scytale AI).
  const aliases = await loadAliases(sb);
  const resolve = (k: string) => aliases.get(k) ?? k;
  const byKey = new Map<string, WarmContact[]>();
  for (const c of (cs ?? []) as any[]) {
    if (!c.company_key) continue;
    const rk = resolve(c.company_key);
    const arr = byKey.get(rk) ?? [];
    arr.push(c as WarmContact);
    byKey.set(rk, arr);
  }

  // משרות פתוחות, בלי מה שכבר הוגש. נשלפות לפני הבחירה, כי חברה שיש בה
  // משרה פתוחה ומכר שלך נכנסת לתור של היום מעל המכסה, ראשונה.
  const { rows: applied } = await loadApplied(sb);
  const appliedIds = new Set(applied.map((a: any) => a.job_id).filter(Boolean));
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  // דפים של 1000: התקרה של PostgREST חלה גם כאן.
  const jobsRaw: any[] = [];
  for (let from = 0; from < 6000; from += 1000) {
    const r = await sb.from('jobs')
    .select('id, title, company, url, source, found_for, first_seen, live_checked_at, location, recruiter_name, recruiter_url')
    .eq('on_target', true)
    // ✕ במסכים הרגילים לא מוריד משרה מכאן (שאול, 20.11.2026: "שלא תוריד").
    // הוא לא מגיש מהמשרה אלא דרך מכר, ולכן סגירה שם אינה סגירה כאן.
    // מה שמוריד אותה: אימות שנסגרה, או "מוותר" על החברה.
    .is('closed_at', null)
    .is('gold_skipped_at', null)
    .gte('first_seen', since)
    .order('first_seen', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + 999);
    if (r.error || !r.data) break;
    jobsRaw.push(...r.data);
    if (r.data.length < 1000) break;
  }
  const fresh = Date.now() - 48 * 3600 * 1000;
  const isVerified = (j: any) => !!j.live_checked_at && new Date(j.live_checked_at).getTime() >= fresh;
  // **כפילויות (21.11.2026):** אותה חברה, אותה כותרת ואותה עיר היא משרה אחת גם
  // אם יש לה שתי כתובות (לינקדאין ואתר החברה). אם תאומה אחת הוגשה, כולן הוגשו.
  // עיר לא מוכרת ("Israel") מתאחדת עם כל עיר, כי זה אותו מודעה בניסוח כללי יותר.
  const twinKey = (j: any) => postingKey(j.company, j.title);
  const appliedTwins = new Map<string, string[]>();
  for (const j of (jobsRaw ?? []) as any[]) {
    if (!appliedIds.has(j.id)) continue;
    const arr = appliedTwins.get(twinKey(j)) ?? [];
    arr.push(cityOf(j.location));
    appliedTwins.set(twinKey(j), arr);
  }
  const twinApplied = (j: any) => {
    const cities = appliedTwins.get(twinKey(j));
    if (!cities) return false;
    const c = cityOf(j.location);
    return cities.some((x) => !x || !c || x === c);
  };
  const jobsByKey = new Map<string, any[]>();
  // משרות בחברות עם איש גיוס מאומת שלא הוצגו, והסיבה. שקיפות: 22.11.2026 שאול
  // שאל "למה רק משרה אחת", והתשובה הייתה צריכה להיות כתובה על המסך.
  const vKeys = new Set<string>();
  for (const c of cs) if (c.verified_ok && c.verified_key) vKeys.add(c.verified_key);
  const dropped: { company: string; title: string; why: string }[] = [];
  const drop = (j: any, why: string) => {
    const k0 = companyKey(j.company);
    if (k0 && vKeys.has(resolve(k0))) dropped.push({ company: j.company, title: j.title, why });
  };
  // לשורת השקיפות: משרות בחברות שיש בהן מכר, כמה אומתו וכמה ממתינות.
  let watched = 0;
  let watchedVerified = 0;
  for (const j of (jobsRaw ?? []) as any[]) {
    if (appliedIds.has(j.id)) { drop(j, 'הוגשה'); continue; }
    if (twinApplied(j)) { drop(j, 'אותה משרה כבר הוגשה בכתובת אחרת'); continue; }
    const wk = companyKey(j.company);
    if (wk && byKey.has(resolve(wk))) { watched++; if (isVerified(j)) watchedVerified++; }
    // מיקום המשרה, לא רק החברה. 'out' לא מוצג, 'unknown' מוצג עם המיקום.
    if (jobPlace(j.location) === 'out') { drop(j, 'מחוץ לגוש דן: ' + (j.location ?? '')); continue; }
    // רלוונטיות לתפקידים שלו: כותרת QA, פרויקטים, תוכניות, שחרורים או מסירה. השער של
    // הסורק רחב (כל כותרת ניהולית), ולכן "IT Manager" עבר אותו ונראה כאן.
    if (!cvFamilyForTitle(j.title) && !CORE_ROLES.includes(j.found_for)) { drop(j, 'הכותרת לא בתחום שלך'); continue; }
    // **חד חד ערכי** (שאול, 20.11.2026: "עוד משרה שלא קיימת יותר"). משרה
    // מוצגת כאן רק אם אומתה כפתוחה בשעות האחרונות. לא אומתה: לא מוצגת.
    if (!isVerified(j)) { drop(j, 'לא אומתה כפתוחה ב-48 השעות האחרונות'); continue; }
    const k0 = companyKey(j.company);
    if (!k0) continue;
    const k = resolve(k0);
    const arr = jobsByKey.get(k) ?? [];
    arr.push(j);
    jobsByKey.set(k, arr);
  }
  // איחוד תאומות בתוך כל חברה: אותה כותרת ואותה עיר (או עיר לא ידועה) הן שורה אחת
  // עם כל המקורות שלה. נשארת זו שאומתה אחרונה.
  for (const [k, js] of jobsByKey) {
    const out: any[] = [];
    for (const j of js) {
      const t = twinKey(j);
      const c = cityOf(j.location);
      const twin = out.find((o) => twinKey(o) === t && (!cityOf(o.location) || !c || cityOf(o.location) === c));
      if (!twin) { out.push({ ...j, sources: [j.source] }); continue; }
      if (j.source && !twin.sources.includes(j.source)) twin.sources.push(j.source);
      if (new Date(j.live_checked_at ?? 0) > new Date(twin.live_checked_at ?? 0)) {
        const sources = twin.sources; Object.assign(twin, j); twin.sources = sources;
      }
    }
    jobsByKey.set(k, out);
  }
  // **"משרה פתוחה" רק אם אומתה.** 20.11.2026 שאול הראה את Fetcherr:
  // לינקדאין אמרה "No longer accepting applications" והמסך הציג אותה
  // כמשרה פתוחה בצבע בולט. עכשיו הקפצה דורשת אימות מהשעות האחרונות,
  // ומשרה שלא אומתה אינה מוצגת בכלל.
  // 22.11.2026: כרטיס לכל חברה שיש בה משרה מאומתת, בלי קשר לרשימת החברות.
  // פרטי החברה (גודל, עיר) נשלפים אם היא ברשימה, ואם לא הכרטיס בנוי מהמשרה.
  const jobKeys = [...jobsByKey.keys()];
  const compByKey = new Map<string, any>();
  for (let i = 0; i < jobKeys.length; i += 100) {
    const { data: hc } = await sb.from('companies')
      .select('id, name, company_key, size_class, size_range, region, city, website, careers_url, is_hiring, gold_done_at, gold_skipped_at')
      .in('company_key', jobKeys.slice(i, i + 100));
    for (const r of (hc ?? []) as any[]) compByKey.set(r.company_key, r);
  }
  // אנשי קשר מאומתים: הסקריפט במחשב פתח את הפרופיל ב-14 הימים האחרונים וראה
  // חבר מדרגה ראשונה, עובד שם עכשיו, בתפקיד גיוס.
  const freshV = Date.now() - 14 * 86400000;
  const verifiedBy = new Map<string, any[]>();
  for (const c of cs) {
    if (!c.verified_ok || !c.verified_key || !c.verified_at) continue;
    if (new Date(c.verified_at).getTime() < freshV) continue;
    const arr = verifiedBy.get(c.verified_key) ?? [];
    arr.push(c);
    verifiedBy.set(c.verified_key, arr);
  }
  const hotIds: string[] = [];
  const hotSet = new Set<string>();

  // המאגר כולו, בלי מה שכבר הוחלט עליו. נשלף בעמודים, כי PostgREST מגביל
  // שורות לשליפה. רק מה שנדרש לדירוג, ואת הפרטים שולפים רק ל-50 שנבחרו.
  const day = israelDayStart().slice(0, 10);
  const dayStart = israelDayStart();
  const pickedIds: string[] = [];
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
        // חברה שיש בה משרה מאומתת מוצגת למעלה כרטיס משרה, לא כאן.
        if (r.company_key && jobsByKey.has(r.company_key)) continue;
        pool.push({ id: r.id, n: r.company_key ? (byKey.get(r.company_key)?.length ?? 0) : 0, gush: r.region === 'gush_dan' });
      }
      if (!data || data.length < 1000) break;
    }
    pool.sort((x, y) => goldRank(x, y, day));
    pickedIds.push(...pool.slice(0, slots).map((x) => x.id));
  }

  const decided = decidedBy.S + decidedBy.M + decidedBy.E;
  const left = Math.max(0, GOLD_DAILY - decided);

  const internalN = await internalApplied(sb);
  const { count: closedDay } = await sb.from('jobs').select('id', { count: 'exact', head: true })
    .gte('closed_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());

  const { data: picked } = pickedIds.length
    ? await sb.from('companies')
        .select('id, name, company_key, size_class, size_range, region, city, website, careers_url, is_hiring')
        .in('id', pickedIds)
    : { data: [] as any[] };
  // כרטיסי משרה: כל חברה שיש בה משרה מאומתת. תכלת אם יש בה איש גיוס מאומת, צהוב אם אין.
  const jobCompanies: any[] = [];
  for (const [k, js] of jobsByKey) {
    if (!js.length) continue;
    const comp = compByKey.get(k);
    if (comp && (comp.gold_done_at || comp.gold_skipped_at)) continue;
    jobCompanies.push({
      key: k,
      comp: comp ?? { id: 'job:' + k, name: js[0].company, company_key: k, size_class: null, size_range: null, region: null, city: null, website: null, careers_url: null, is_hiring: false },
      noCompany: !comp,
      js,
    });
  }
  const findIds = [...pickedIds, ...jobCompanies.filter((x) => !x.noCompany).map((x) => x.comp.id)];
  // מגייסים שנמצאו בחיפוש לחברות בלי איש קשר (gold_recruiters).
  const finds = new Map<string, { id: string; name: string; headline: string | null; url: string }[]>();
  if (findIds.length) {
    const { data: fr } = await sb.from('gold_recruiters')
      .select('id, company_id, full_name, headline, profile_url')
      .in('company_id', findIds).is('contacted_at', null).is('skipped_at', null);
    for (const f of (fr ?? []) as any[]) {
      const arr = finds.get(f.company_id) ?? [];
      arr.push({ id: f.id, name: f.full_name, headline: f.headline, url: f.profile_url });
      finds.set(f.company_id, arr);
    }
  }
  const classOrder: Record<string, number> = { E: 0, M: 1, S: 2 };
  const ranked = ((picked ?? []) as GoldCompany[])
    .map((c) => ({ c, n: c.company_key ? (byKey.get(c.company_key)?.length ?? 0) : 0 }))
    .sort((x, y) => (y.n - x.n)
      || ((x.c.region === 'gush_dan' ? 0 : 1) - (y.c.region === 'gush_dan' ? 0 : 1))
      || ((classOrder[x.c.size_class ?? ''] ?? 3) - (classOrder[y.c.size_class ?? ''] ?? 3)));

  const toRow = (
    c: any, tier: 'blue' | 'yellow' | 'plain', jobs: any[], pplSrc: any[], noCompany: boolean, n: number, unverifiedN: number,
  ): GoldRow => {
    const top = jobs[0] ?? null;
    const people = rankContacts(pplSrc, top?.title, isAgency(c.name)).slice(0, 3);
    const cvId = top ? (cvFamilyForTitle(top.title) ?? 'project-release-manager') : null;
    return {
      id: c.id,
      hot: tier !== 'plain',
      tier,
      noCompany,
      unverifiedN,
      name: c.name,
      sizeRange: c.size_range,
      sizeClass: c.size_class,
      city: c.city,
      gushDan: c.region === 'gush_dan',
      website: c.website,
      careers: c.careers_url,
      hiring: c.is_hiring,
      contactsTotal: n,
      peopleHref: peopleAtCompanyHref(c.name, null),
      genericMessage: goldGenericMessage(c.name, top ? { title: top.title, url: top.url, foundFor: top.found_for } : null, cvId),
      recruitersHref: 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent('recruiter ' + c.name),
      cvFile: top ? cvFileFor(cvId, top.title) : WIDE_CV_FILE,
      jobs: jobs.slice(0, 4).map((j) => ({ id: j.id, title: j.title, url: j.url, source: (j.sources ?? [j.source]).filter(Boolean).join(' + '), verified: isVerified(j), verifiedAt: j.live_checked_at ?? null, location: j.location ?? null, recruiterName: j.recruiter_name ?? null, recruiterUrl: j.recruiter_url ?? null,
        // הודעה וקובץ לכל משרה בנפרד: אותה חברה יכולה להחזיק משרת QA ומשרת פרויקטים,
        // ולכל אחת קישור וקובץ קורות חיים משלה.
        foundFor: j.found_for ?? null,
        ...(() => {
          const jcv = cvFamilyForTitle(j.title) ?? 'project-release-manager';
          const jj = { title: j.title, url: j.url, foundFor: j.found_for };
          const who = people[0];
          return {
            cvFile: cvFileFor(jcv, j.title),
            message: who
              ? goldMessage({ contactName: who.full_name, contactTitle: who.title, company: c.name, job: jj, cvId: jcv })
              : goldGenericMessage(c.name, jj, jcv),
          };
        })() })),
      finds: (finds.get(c.id) ?? []).map((f) => ({
        ...f,
        note: goldConnectNote({ name: f.name, company: c.name, jobTitle: top?.title ?? null }),
      })),
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
  };

  const newest = (js: any[]) => Math.max(...js.map((j) => new Date(j.first_seen ?? 0).getTime()));
  const jobRows: GoldRow[] = jobCompanies
    .map((x) => {
      const v = verifiedBy.get(x.key) ?? [];
      const all = byKey.get(x.key) ?? [];
      return { x, v, t: newest(x.js), un: Math.max(0, all.length - v.length) };
    })
    .sort((a, b) => b.t - a.t) // מהחדש לישן (27.11.2026). הצבע (תכלת או צהבהב) נשאר סימן, לא מפתח מיון.
    .map(({ x, v, un }) => toRow(x.comp, v.length ? 'blue' : 'yellow', x.js, v, x.noCompany, v.length, un));

  const plainRows: GoldRow[] = ranked.map(({ c, n }) =>
    toRow(c, 'plain', [], byKey.get(c.company_key) ?? [], false, n, 0));
  const rows: GoldRow[] = [...jobRows, ...plainRows];
  const blueN = jobRows.filter((r) => r.tier === 'blue').length;
  const yellowN = jobRows.length - blueN;

  return (
    <main>
      <div className="head">
        <h1>חברות זהב</h1>
        <Link className="more" href="/">← חדר המצב</Link>
      </div>
      <p className="sub">
        משרות פתוחות שאומתו ב-48 השעות האחרונות, עם איש גיוס שנבדק בפרופיל שלו.
        {' '}מסודר מהחדש לישן לפי מועד כניסת המשרה, בכל אחת משתי הרשימות.
        {' '}תכלת: {jobRows.filter((r) => r.tier === 'blue').length} משרות עם איש גיוס מאומת. צהבהב: {jobRows.filter((r) => r.tier === 'yellow').length} משרות מאומתות בלי איש גיוס.
      </p>
      <GoldSimple dropped={dropped} ready={jobRows.filter((r) => r.tier === 'blue')} waiting={jobRows.filter((r) => r.tier === 'yellow')} />
      <p className="hint" style={{ marginTop: '1.2rem' }}>
        מקור המאגר: techmap, מבוסס על רשם החברות, ברישיון ODbL.
      </p>
    </main>
  );
}
