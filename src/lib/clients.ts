import { companyKey } from '@/lib/contacts';

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
export const STAGES = ['משרה פתוחה', 'נשלחה הודעה', 'ענתה', 'שיחה נקבעה', 'הוגשה', 'ראיון', 'נסגרה'] as const;

export type ClientJob = {
  id: string; title: string; company: string; url: string | null;
  stage: number; ageDays: number | null; applied: boolean;
  /** ימים מאז ההגשה, רק למשרה שהוגשה. */
  appliedDays: number | null; silent: boolean;
  /** מזהה שורת ההגשה, כדי לרשום ראיון או סגירה. */
  appId: string | null; closed: boolean;
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
  note: string | null; connectedOn: string | null; acceptedAt: string | null;
  contactedAt: string | null; repliedAt: string | null;
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

export async function loadClients(sb: any): Promise<{ clients: Client[]; error?: string }> {
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
        .select('jobs!inner(id, title, company, url, first_seen, on_target, dismissed_at, closed_at)')
        .eq('jobs.on_target', true).is('jobs.dismissed_at', null).is('jobs.closed_at', null)
        .gte('jobs.first_seen', since).order('job_id').range(a, b), 1000, 4000),
      pageAll((a, b) => sb.from('applications')
        .select('id, job_id, status, stage, sent_at, jobs(id, title, company, url, first_seen)').order('id').range(a, b)),
      pageAll((a, b) => sb.from('company_aliases').select('alias_key, company_key').range(a, b)),
      pageAll((a, b) => sb.from('prior_requests').select('slug, full_name, title, company, sent_on').order('slug').range(a, b)).catch(() => []),
    ]);

    const alias = new Map<string, string>(aliasRows.map((r: any) => [r.alias_key, r.company_key]));
    const keyOf = (name?: string | null) => { const k = companyKey(name); return k ? (alias.get(k) ?? k) : ''; };

    // משרות לפי חברה: פתוחות ומתאימות, ועוד כל משרה שהוגש אליה.
    const jobsByCo = new Map<string, Map<string, ClientJob>>();
    const put = (j: any, applied: boolean, status?: string | null, stage?: string | null, sentAt?: string | null, appId?: string | null) => {
      if (!j?.id) return;
      const k = keyOf(j.company); if (!k) return;
      const m = jobsByCo.get(k) ?? new Map<string, ClientJob>();
      const prev = m.get(j.id);
      const closed = applied && (status === 'rejected' || status === 'offer');
      const st = closed ? 7 : applied ? (stage === 'interview' || status === 'interview' ? 6 : 5) : 1;
      if (!prev || st > prev.stage) {
        m.set(j.id, {
          id: j.id, title: j.title, company: j.company, url: j.url ?? null, applied, stage: st,
          appliedDays: applied && sentAt ? Math.max(0, Math.round((Date.now() - new Date(sentAt).getTime()) / 864e5)) : null,
          silent: applied && status === 'silent', appId: appId ?? null, closed,
          ageDays: j.first_seen ? Math.max(0, Math.round((Date.now() - new Date(j.first_seen).getTime()) / 864e5)) : null,
        });
      }
      jobsByCo.set(k, m);
    };
    for (const m of matches) put(m.jobs, false);
    for (const a of apps) put(a.jobs, true, a.status, a.stage, a.sent_at, a.id);

    type Extra = 'note' | 'connectedOn' | 'acceptedAt' | 'contactedAt' | 'repliedAt';
    // מי שכבר קיבל ממנו פנייה ראשונה (גל מאי) או שיש איתו שיחה: לא מציעים לו הודעה כללית נוספת.
    const pitched = new Set<string>();
    const mk = (base: Omit<Client, 'jobs' | 'stage' | 'next' | 'urgent' | 'companyKey' | 'silentCount' | Extra> & Partial<Pick<Client, Extra>> & { companyKey: string },
                contactedJobId: string | null, contacted: boolean, replied: boolean, urgent: boolean): Client => {
      const jobs = [...(jobsByCo.get(base.companyKey)?.values() ?? [])];
      for (const j of jobs) {
        if (j.stage === 1 && contacted && (!contactedJobId || contactedJobId === j.id)) j.stage = replied ? 3 : 2;
      }
      jobs.sort((a, b) => b.stage - a.stage || (a.ageDays ?? 999) - (b.ageDays ?? 999));
      // משרה שנסגרה לא מקדמת את הלקוח: הוא מתקדם לפי המשרה החיה הרחוקה ביותר.
      const live = jobs.filter((j) => !j.closed);
      const stage = live.length ? live.reduce((s, j) => Math.max(s, j.stage), 0) : jobs.length ? 7 : 0;
      const open = jobs.filter((j) => !j.applied);
      const silentCount = jobs.filter((j) => j.silent).length;
      let next: string | null = null;
      if (base.kind === 'prior') next = null; // בקשה מלפני חודשים שלא אושרה: אין מה לעשות איתה מעבר לעקוב
      else if (urgent) next = 'ענתה: לענות לה';
      else if (silentCount >= SILENT_LIMIT && !(base.contactedAt ?? null)) next = 'פנה ישירות, לא להגיש עוד';
      else if (base.status === 'requested') next = 'מחכה לאישור חברות';
      else if (open.length && base.status === 'none') next = 'לשלוח בקשת חברות';
      else if (open.length && !contacted) next = 'לשלוח הודעה';
      // מנהל פיתוח חבר בלי משרה פתוחה: הודעת היכרות כללית, שמבקשת שיזכור אותו. לא כשכבר פנה אליו.
      else if (!open.length && base.kind === 'contact' && base.group === 'dev' && base.status === 'friend' && !contacted && !replied && !pitched.has(base.id)) next = 'לשלוח הודעה';
      else if (open.length && contacted && !replied) next = 'מחכה לתשובה';
      return { note: null, connectedOn: null, acceptedAt: null, contactedAt: null, repliedAt: null, ...base, silentCount, jobs, stage, next, urgent };
    };

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
    return { clients: out };
  } catch (e: any) {
    return { clients: [], error: String(e?.message ?? e) };
  }
}
