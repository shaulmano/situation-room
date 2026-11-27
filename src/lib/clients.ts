import { companyKey } from '@/lib/contacts';
import { postingKey } from '@/lib/dedupe';

/**
 * רשימת הלקוחות של ה-CRM: אנשי קשר ומגייסים, החברה שלהם, והמשרות בחברה.
 *
 * 26.11.2026. שאול: "כל מידע קיים, זה רק איך להציג". לכן אין כאן טבלה חדשה
 * ואין כתיבה. הכול נגזר מ-contacts, gold_recruiters, matches ו-applications,
 * באותם תנאים שבהם משתמשים שאר המסכים. הסטטוסים לא נשמרים: הם מחושבים בכל
 * טעינה, כדי שלא יתנתקו מהמציאות כמו `manual_dup`.
 */
/** מעל מספר הגשות כזה בלי מענה לאותה חברה, ממליצים לפנות ישירות ולא להגיש עוד. */
export const SILENT_LIMIT = 3;
/** הערה שנכתבת על הגשה כשהמשרה עצמה נסגרה (ולא שנדחה). */
export const CLOSED_NOTE = 'המשרה נסגרה';
export const STAGES = ['משרה פתוחה', 'נשלחה הודעה', 'ענתה', 'הוגשה', 'שיחה נקבעה', 'ראיון', 'נסגרה'] as const;

export type ClientJob = {
  id: string; title: string; company: string; url: string | null;
  stage: number; ageDays: number | null; applied: boolean;
  /** מפתח איחוד: מזהה לינקדאין כשיש, אחרת מזהה המשרה. */
  dk: string;
  /** מתי המשרה נראתה לראשונה, לסדר מהחדש לישן. */
  seenAt: string | null;
  /** תאריך הפרסום במקור (יום בלי שעה), כשהמקור מוסר אותו. */
  posted: string | null;
  /** הוגשה כבר משרה באותה חברה ובאותה כותרת (עותק אחר של אותה מודעה): תאריך ההגשה. סימון לקריאה בלבד, כמו במסכים האחרים. */
  priorApplied: string | null;
  location: string | null;
  /** ימים מאז ההגשה, רק למשרה שהוגשה. */
  appliedDays: number | null; silent: boolean;
  /** מזהה שורת ההגשה, כדי לרשום ראיון או סגירה. */
  appId: string | null; closed: boolean;
  /** למה נסגרה: נדחה, המשרה נסגרה או הצעה. */
  closeReason: string | null;
};
export type Client = {
  id: string; kind: 'contact' | 'gold' | 'prior';
  name: string; title: string | null; company: string | null; companyKey: string;
  profile: string | null; email: string | null; phone: string | null;
  group: 'recruiter' | 'dev' | 'other';
  status: 'none' | 'requested' | 'friend';
  jobs: ClientJob[]; stage: number;
  next: string | null; urgent: boolean; replyText: string | null; replyDraft?: string | null;
  /** כמה הגשות לחברה הזאת נשארו בלי מענה. */
  silentCount: number;
  /** סומן "לא לפנות" (או ויתור בפנייה הרחבה): אין צעד הבא עד שמחזירים. */
  skipped?: boolean;
  note: string | null; connectedOn: string | null; acceptedAt: string | null;
  contactedAt: string | null; repliedAt: string | null;
  /** הפעילות האחרונה סביב הלקוח: משרה פתוחה חדשה, תגובה, אישור חברות או פנייה. */
  activityAt: string;
};

const REC = /recruit|talent|\bhr\b|human resources|acquisition|sourcer|גיוס|משאבי אנוש|מגייס/i;
const DEV = /\bcto\b|vp r&d|vp eng|head of (r&d|eng|dev)|engineering manager|director of eng|מנהל פיתוח|סמנכ"ל פיתוח|מנהל ה?מחקר|r&d manager/i;

async function pageAll(build: (from: number, to: number) => any, size = 1000, cap = 8000): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < cap; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

/** חברה עם משרה פתוחה ומתאימה, ובלי אף איש קשר, מגייס או בקשה במערכת. */
/** שורה במסך "לפי משרה": משרה פתוחה אחת, והלקוחות בחברה שלה. אין כאן עותק של מצב: המצב נשאר על הלקוח ועל המשרה. */
export type FeedItem = { job: ClientJob; key: string; company: string; clientIds: string[] };
export type Orphan = { company: string; jobs: { id: string; title: string; url: string | null; ageDays: number | null }[] };

export async function loadClients(sb: any): Promise<{ clients: Client[]; orphans: Orphan[]; feed: FeedItem[]; error?: string }> {
  try {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [contacts, gold, matches, apps, aliasRows, prior] = await Promise.all([
      pageAll((a, b) => sb.from('contacts')
        .select('id, full_name, title, company, company_key, linkedin_url, email, phone, note, connected_on, contacted_at, replied_at, '
          + 'reply_done_at, reply_text, reply_draft, first_pitch_at, li_seen_at, invite_accepted_at, left_company_at, last_job_id, skipped_at')
        .order('id').range(a, b)),
      pageAll((a, b) => sb.from('gold_recruiters')
        .select('id, company_id, full_name, headline, profile_url, contacted_at, skipped_at, companies(name)')
        .order('id').range(a, b)),
      pageAll((a, b) => sb.from('matches')
        .select('jobs!inner(id, title, company, url, first_seen, posted, location, on_target, dismissed_at, closed_at)')
        .eq('jobs.on_target', true).is('jobs.dismissed_at', null).is('jobs.closed_at', null)
        .gte('jobs.first_seen', since).order('job_id').range(a, b), 1000, 4000),
      pageAll((a, b) => sb.from('applications')
        .select('id, job_id, status, stage, sent_at, note, jobs(id, title, company, url, first_seen, posted)').order('id').range(a, b)),
      pageAll((a, b) => sb.from('company_aliases').select('alias_key, company_key').range(a, b)),
      pageAll((a, b) => sb.from('prior_requests').select('slug, full_name, title, company, sent_on').order('slug').range(a, b)).catch(() => []),
    ]);

    const alias = new Map<string, string>(aliasRows.map((r: any) => [r.alias_key, r.company_key]));
    const keyOf = (name?: string | null) => { const k = companyKey(name); return k ? (alias.get(k) ?? k) : ''; };

    // משרות לפי חברה: פתוחות ומתאימות, ועוד כל משרה שהוגש אליה.
    const jobsByCo = new Map<string, Map<string, ClientJob>>();
    const dkById = new Map<string, string>();
    // אותה חברה ואותה כותרת כבר הוגשה (מודעה שהגיעה מלוח אחר בכתובת אחרת). מסומנת ולא מוסתרת: ההחלטה שלו.
    const appliedPosting = new Map<string, string>();
    const appliedIds = new Set<string>();
    for (const a of apps as any[]) {
      if (a.job_id) appliedIds.add(a.job_id);
      if (a.jobs?.company && a.jobs?.title) appliedPosting.set(postingKey(a.jobs.company, a.jobs.title), a.sent_at ?? '');
    }
    const put = (j: any, applied: boolean, status?: string | null, stage?: string | null, sentAt?: string | null, appId?: string | null, note?: string | null) => {
      if (!j?.id) return;
      // 27.11.2026: משרה בלי שם חברה (דיאלוג, SQLink) קיבלה מפתח ריק ונעלמה מהמסך. עכשיו כל אחת היא שורה נפרדת בחברות בלי איש קשר.
      const k = keyOf(j.company) || (applied ? '' : '__nc:' + j.id); if (!k) return;
      const m = jobsByCo.get(k) ?? new Map<string, ClientJob>();
      // אותה משרה בלינקדאין יכולה להיכנס פעמיים עם כותרת שונה ואותו מזהה בסוף הכתובת (AMAREL, 26.11.2026).
      const li = typeof j.url === 'string' ? j.url.match(/linkedin\.com\/jobs\/view\/[^?#]*?(\d{8,})\/?(?:[?#]|$)/) : null;
      const dk = li ? 'li:' + li[1] : j.id;
      dkById.set(j.id, dk);
      const prev = m.get(dk);
      const closed = applied && (status === 'rejected' || status === 'offer');
      const st = closed ? 7 : applied ? (stage === 'interview' || status === 'interview' ? 6 : stage === 'call' || status === 'conversation' ? 5 : 4) : 1;
      const closeReason = !closed ? null : status === 'offer' ? 'הצעה' : note === CLOSED_NOTE ? 'המשרה נסגרה' : 'נדחה';
      if (!prev || st > prev.stage) {
        m.set(dk, {
          id: j.id, dk, seenAt: j.first_seen ?? null, posted: j.posted ?? null, location: j.location ?? null,
          priorApplied: !applied && !appliedIds.has(j.id) ? (appliedPosting.get(postingKey(j.company, j.title)) ?? null) : null, title: j.title, company: j.company, url: j.url ?? null, applied, stage: st,
          appliedDays: applied && sentAt ? Math.max(0, Math.round((Date.now() - new Date(sentAt).getTime()) / 864e5)) : null,
          silent: applied && status === 'silent', appId: appId ?? null, closed, closeReason,
          ageDays: j.first_seen ? Math.max(0, Math.round((Date.now() - new Date(j.first_seen).getTime()) / 864e5)) : null,
        });
      }
      jobsByCo.set(k, m);
    };
    for (const m of matches) put(m.jobs, false);
    for (const a of apps) put(a.jobs, true, a.status, a.stage, a.sent_at, a.id, a.note);

    type Extra = 'note' | 'connectedOn' | 'acceptedAt' | 'contactedAt' | 'repliedAt';
    // מי שכבר קיבל ממנו פנייה ראשונה (גל מאי) או שיש איתו שיחה: לא מציעים לו הודעה כללית נוספת.
    const pitched = new Set<string>();
    // 26.11.2026, שאול: משרה אחת בחברה מוצעת לכל מי שמכיר שם, ומרגע שסימן "שלחתי" אצל אחד, אצל השאר הצעד נעלם.
    // רק פנייה שנרשמה עם משרה (last_job_id) סופרת. פנייה כללית בלי משרה לא מכסה אף משרה.
    const via = new Map<string, { id: string; name: string }>();
    for (const c of contacts as any[]) {
      if (!c.contacted_at || !c.last_job_id || c.skipped_at || c.left_company_at) continue;
      const k = dkById.get(c.last_job_id) ?? c.last_job_id;
      if (!via.has(k)) via.set(k, { id: 'c:' + c.id, name: c.full_name ?? '' });
    }
    const mk = (base: Omit<Client, 'jobs' | 'stage' | 'next' | 'urgent' | 'companyKey' | 'silentCount' | 'activityAt' | Extra> & Partial<Pick<Client, Extra>> & { companyKey: string },
                contactedJobId: string | null, contacted: boolean, replied: boolean, urgent: boolean): Client => {
      const jobs = [...(jobsByCo.get(base.companyKey)?.values() ?? [])];
      for (const j of jobs) {
        if (j.stage === 1 && contacted && (!contactedJobId || contactedJobId === j.id)) j.stage = replied ? 3 : 2;
      }
      // מהחדש לישן (27.11.2026, שאול). הסדר לא משפיע על השלב, שמחושב בנפרד.
      // משרות פתוחות קודם (28.11.2026, שאול: "משרות פתוחות באותו אריח לא מוצגות ראשונות"), ובתוכן מהחדש לישן.
      const isOpenJob = (j: ClientJob) => !j.applied && !j.closed;
      jobs.sort((a, b) => Number(isOpenJob(b)) - Number(isOpenJob(a)) || (b.seenAt ?? '').localeCompare(a.seenAt ?? ''));
      // משרה שנסגרה לא מקדמת את הלקוח: הוא מתקדם לפי המשרה החיה הרחוקה ביותר.
      const live = jobs.filter((j) => !j.closed);
      const stage = live.length ? live.reduce((s, j) => Math.max(s, j.stage), 0) : jobs.length ? 7 : 0;
      const openAll = jobs.filter((j) => !j.applied);
      const covered = (j: ClientJob) => { const v = via.get(j.dk); return !!v && v.id !== base.id; };
      const open = openAll.filter((j) => !covered(j));
      const coveredBy = openAll.length && !open.length ? via.get(openAll[0].dk)?.name ?? '' : '';
      const silentCount = jobs.filter((j) => j.silent).length;
      let next: string | null = null;
      if (base.kind === 'prior') next = null; // בקשה מלפני חודשים שלא אושרה: אין מה לעשות איתה מעבר לעקוב
      else if (urgent) next = 'ענתה: לענות לה';
      else if (silentCount >= SILENT_LIMIT && !(base.contactedAt ?? null)) next = 'פנה ישירות, לא להגיש עוד';
      else if (base.status === 'requested') next = 'מחכה לאישור חברות';
      else if (coveredBy) next = `מחכה: פנית דרך ${coveredBy}`;
      else if (open.length && base.status === 'none') next = 'לשלוח בקשת חברות';
      else if (open.length && !contacted) next = 'לשלוח הודעה';
      // מנהל פיתוח או מגייס/ת חבר בלי משרה פתוחה: הודעת היכרות כללית, שמבקשת שיזכור אותו. לא כשכבר פנה אליו.
      else if (!open.length && base.kind === 'contact' && (base.group === 'dev' || base.group === 'recruiter') && base.status === 'friend' && !contacted && !replied && !pitched.has(base.id)) next = 'לשלוח הודעה';
      else if (open.length && contacted && !replied) next = 'מחכה לתשובה';
      const full = { note: null, connectedOn: null, acceptedAt: null, contactedAt: null, repliedAt: null, ...base };
      const newestOpen = jobs.filter((j) => !j.applied && !j.closed).map((j) => j.seenAt ?? '').sort().pop() ?? '';
      const activityAt = [newestOpen, full.repliedAt ?? '', full.acceptedAt ?? '', full.contactedAt ?? '', full.connectedOn ?? ''].sort().pop() ?? '';
      return { ...full, silentCount, jobs, stage, next, urgent, activityAt };
    };

    // 26.11.2026, שאול: ויתור על כל אנשי הקשר של חברה הוא ויתור על המשרה, לא על האנשים. חברה עם שניים ומעלה, כולם מסומנים.
    const coTotal = new Map<string, number>(); const coSkipped = new Map<string, number>();
    for (const c of contacts as any[]) {
      if (c.left_company_at) continue;
      const k = keyOf(c.company) || (c.company_key ?? ''); if (!k) continue;
      coTotal.set(k, (coTotal.get(k) ?? 0) + 1);
      if (c.skipped_at) coSkipped.set(k, (coSkipped.get(k) ?? 0) + 1);
    }
    const out: Client[] = [];
    for (const c of contacts as any[]) {
      if (c.first_pitch_at || c.li_seen_at) pitched.add('c:' + c.id);
      if (c.left_company_at) continue;
      const k = keyOf(c.company) || (c.company_key ?? '');
      const t = `${c.title ?? ''}`;
      const group = DEV.test(t) ? 'dev' : REC.test(t) ? 'recruiter' : 'other';
      const replied = !!c.replied_at;
      out.push(mk({
        id: 'c:' + c.id, kind: 'contact', name: c.full_name ?? '', title: c.title ?? null,
        company: c.company ?? null, companyKey: k, profile: c.linkedin_url ?? null,
        email: c.email ?? null, phone: c.phone ?? null, group, status: 'friend',
        replyText: replied && !c.reply_done_at ? (c.reply_text ?? null) : null,
        replyDraft: replied && !c.reply_done_at ? (c.reply_draft ?? null) : null,
        note: c.note ?? null, connectedOn: c.connected_on ?? null, acceptedAt: c.invite_accepted_at ?? null,
        contactedAt: c.contacted_at ?? null, repliedAt: c.replied_at ?? null,
      }, c.last_job_id ?? null, !!c.contacted_at, replied, replied && !c.reply_done_at));
      // "לא לפנות" נכתב ל-skipped_at. בלי זה הלחיצה לא שינתה כלום על המסך אחרי רענון (26.11.2026).
      // תגובה שממתינה לתשובה נשארת: היא קודמת לסימון.
      const last = out[out.length - 1];
      // ויתור על כולם חל רק כשיש משרה פתוחה: אז האנשים חוזרים לצעד הבא. בלי משרה פתוחה הוויתור נשאר.
      const waivedAll = (coTotal.get(k) ?? 0) >= 2 && coSkipped.get(k) === coTotal.get(k) && last.jobs.some((j) => !j.applied && !j.closed);
      if (c.skipped_at && !waivedAll) last.skipped = true;
      if (c.skipped_at && !waivedAll && !last.urgent) last.next = null;
    }
    // אותו אדם כחבר וגם כבקשה: החבר גובר. זיהוי לפי פרופיל, ובלעדיו לפי שם וחברה.
    const slug = (u?: string | null) => { try { return decodeURIComponent((u ?? '').split('/in/')[1]?.split(/[/?#]/)[0] ?? '').toLowerCase(); } catch { return ''; } };
    const haveSlug = new Set(out.map((c) => slug(c.profile)).filter(Boolean));
    const haveNameCo = new Set(out.map((c) => `${c.name.trim().toLowerCase()}|${c.companyKey}`));
    for (const g of gold as any[]) {
      if (g.skipped_at) continue;
      if (haveSlug.has(slug(g.profile_url)) && slug(g.profile_url)) continue;
      if (haveNameCo.has(`${(g.full_name ?? '').trim().toLowerCase()}|${keyOf(g.companies?.name ?? '')}`)) continue;
      const name = g.companies?.name ?? '';
      out.push(mk({
        id: 'g:' + g.id, kind: 'gold', name: g.full_name ?? '', title: g.headline ?? null,
        company: name || null, companyKey: keyOf(name), profile: g.profile_url ?? null,
        email: null, phone: null, group: DEV.test(g.headline ?? '') ? 'dev' : 'recruiter',
        status: g.contacted_at ? 'requested' : 'none', replyText: null,
      }, null, false, false, false));
    }
    // גל מאי: מי שקיבל בקשה או הודעה לפני חודשים ולא אישר. מי שכבר חבר או בבקשה פעילה לא נכפל.
    const known = new Set(out.map((c) => slug(c.profile)).filter(Boolean));
    for (const r of prior as any[]) {
      if (known.has(r.slug)) continue;
      out.push(mk({
        id: 'p:' + r.slug, kind: 'prior', name: r.full_name ?? '', title: r.title ?? null,
        company: r.company ?? null, companyKey: keyOf(r.company ?? ''),
        profile: `https://www.linkedin.com/in/${encodeURIComponent(r.slug)}`,
        email: null, phone: null, group: DEV.test(r.title ?? '') ? 'dev' : REC.test(r.title ?? '') ? 'recruiter' : 'other',
        status: 'none', replyText: null, note: `בקשה או הודעה נשלחה ב-${r.sent_on ?? 'מאי'}, ולא אושרה`,
      }, null, false, false, false));
    }
    // 26.11.2026, שאול: משרה בחברה בלי אף לקוח לא יורדת בין הכיסאות. מחושב, לא נשמר.
    const haveCo = new Set(out.map((c) => c.companyKey).filter(Boolean));
    const orphans: Orphan[] = [];
    for (const [k, m] of jobsByCo) {
      if (haveCo.has(k)) continue;
      const open = [...m.values()].filter((j) => !j.applied && !j.closed);
      if (!open.length) continue;
      open.sort((a, b) => (a.ageDays ?? 999) - (b.ageDays ?? 999));
      orphans.push({ company: open[0].company || `ללא שם חברה (${open[0].title})`, jobs: open.map((j) => ({ id: j.id, title: j.title, url: j.url, ageDays: j.ageDays })) });
    }
    orphans.sort((a, b) => (a.jobs[0].ageDays ?? 999) - (b.jobs[0].ageDays ?? 999));
    // 27.11.2026, שאול: "אמת אחת". כל המשרות הפתוחות מהחדשה לישנה לפי תאריך הפרסום, וכל אחת
    // מצביעה על אותם לקוחות ואותה משרה שבמסך הלקוחות. לא נשמר ולא מחושב מצב נוסף.
    const byCo = new Map<string, string[]>();
    for (const c of out) if (c.companyKey) byCo.set(c.companyKey, [...(byCo.get(c.companyKey) ?? []), c.id]);
    const feed: FeedItem[] = [];
    for (const [k, m] of jobsByCo) for (const j of m.values()) {
      if (j.applied || j.closed) continue;
      feed.push({ job: j, key: k, company: j.company || 'ללא שם חברה', clientIds: byCo.get(k) ?? [] });
    }
    const day = (j: ClientJob) => new Date(j.posted ? `${j.posted}T00:00:00` : (j.seenAt ?? 0)).setHours(0, 0, 0, 0);
    feed.sort((a, b) => day(b.job) - day(a.job) || (b.job.seenAt ?? '').localeCompare(a.job.seenAt ?? ''));
    return { clients: out, orphans, feed };
  } catch (e: any) {
    return { clients: [], orphans: [], feed: [], error: String(e?.message ?? e) };
  }
}
