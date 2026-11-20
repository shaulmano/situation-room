import Link from 'next/link';
import { serverClient } from '@/lib/server';
import GoldList, { type GoldRow } from '@/components/GoldList';
import { companyKey, type WarmContact } from '@/lib/contacts';
import { rankContacts, isAgency } from '@/lib/pickContact';
import { cvFamilyForTitle, cvFileFor } from '@/lib/outreach';
import { israelDayStart, WIDE_CV_FILE } from '@/lib/wideReach';
import { loadApplied } from '@/lib/priorApplication';
import { GOLD_DAILY, goldMessage, goldOrder, type GoldCompany } from '@/lib/gold';

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
    .select('id, full_name, title, company, company_key, linkedin_url, email, phone, contacted_at')
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

  // PostgREST מגביל שורות לשליפה, ולכן החברות נשלפות במקבצים לפי מפתח.
  const keys = [...byKey.keys()];
  const companies: GoldCompany[] = [];
  for (let i = 0; i < keys.length; i += 120) {
    const { data, error: ce } = await sb.from('companies')
      .select('id, name, company_key, size_class, size_range, region, city, website, careers_url, is_hiring')
      .in('company_key', keys.slice(i, i + 120))
      .is('gold_done_at', null)
      .is('gold_skipped_at', null);
    if (ce) {
      return (
        <main>
          <div className="head"><h1>חברות זהב</h1><Link className="more" href="/">← חדר המצב</Link></div>
          <div className="alert">שגיאה בשליפת החברות: {ce.message}</div>
        </main>
      );
    }
    companies.push(...((data ?? []) as GoldCompany[]));
  }

  const dayStart = israelDayStart();
  const [{ count: doneToday }, { count: skippedToday }, { count: pool }] = await Promise.all([
    sb.from('companies').select('id', { count: 'exact', head: true }).gte('gold_done_at', dayStart),
    sb.from('companies').select('id', { count: 'exact', head: true }).gte('gold_skipped_at', dayStart),
    sb.from('companies').select('id', { count: 'exact', head: true }),
  ]);
  const decided = (doneToday ?? 0) + (skippedToday ?? 0);
  const left = Math.max(0, GOLD_DAILY - decided);

  const ranked = companies
    .map((c) => ({ c, n: byKey.get(c.company_key)?.length ?? 0 }))
    .filter((x) => x.n > 0)
    .sort(goldOrder)
    .slice(0, left);

  // משרות פתוחות בחברות שנבחרו, בלי מה שכבר הוגש.
  const { rows: applied } = await loadApplied(sb);
  const appliedIds = new Set(applied.map((a: any) => a.job_id).filter(Boolean));
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: jobsRaw } = await sb.from('jobs')
    .select('id, title, company, url, source, found_for, first_seen')
    .eq('on_target', true)
    .is('dismissed_at', null)
    .gte('first_seen', since)
    .order('first_seen', { ascending: false })
    .limit(4000);
  const wanted = new Set(ranked.map((x) => x.c.company_key));
  const jobsByKey = new Map<string, any[]>();
  for (const j of (jobsRaw ?? []) as any[]) {
    if (appliedIds.has(j.id)) continue;
    const k = companyKey(j.company);
    if (!wanted.has(k)) continue;
    const arr = jobsByKey.get(k) ?? [];
    arr.push(j);
    jobsByKey.set(k, arr);
  }

  const rows: GoldRow[] = ranked.map(({ c, n }) => {
    const jobs = jobsByKey.get(c.company_key) ?? [];
    const top = jobs[0] ?? null;
    const people = rankContacts(byKey.get(c.company_key) ?? [], top?.title, isAgency(c.name)).slice(0, 3);
    const cvId = top ? (cvFamilyForTitle(top.title) ?? 'project-release-manager') : null;
    return {
      id: c.id,
      name: c.name,
      sizeRange: c.size_range,
      sizeClass: c.size_class,
      city: c.city,
      gushDan: c.region === 'gush_dan',
      website: c.website,
      careers: c.careers_url,
      hiring: c.is_hiring,
      contactsTotal: n,
      cvFile: top ? cvFileFor(cvId, top.title) : WIDE_CV_FILE,
      jobs: jobs.slice(0, 4).map((j) => ({ id: j.id, title: j.title, url: j.url, source: j.source })),
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
        חברות שיש בהן מי שאתה מכיר, מהסדר: הכי הרבה מכרים, גוש דן, גודל.
        {' '}{GOLD_DAILY} ביום. במאגר {pool ?? 0} חברות, ובהן {byKey.size} מפתחות עם מכר.
      </p>
      <GoldList rows={rows} target={GOLD_DAILY} doneToday={decided} />
      <p className="hint" style={{ marginTop: '1.2rem' }}>
        מקור המאגר: techmap, מבוסס על רשם החברות, ברישיון ODbL.
      </p>
    </main>
  );
}
