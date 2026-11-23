import { companyKey, contactsByCompanyKeys } from '@/lib/contacts';

/**
 * כמה פריטים מחכים לך במסך מכרים: תגובות שלא טופלו, ועוד הגשות מהיום שמחכות לפנייה דרך מכר.
 * ההגשות הן אותה ספירה כמו הלשונית "היום" במסך
 * מכרים (`warm/page.tsx`), בלי בניית הכרטיסים. הגשה אחת לכל משרה, בחברה שיש בה
 * איש קשר שעוד לא פנית אליו. אין כאן הסינון של מי שכבר קיבל הודעה בטאב
 * המפרסמים, ולכן המספר יכול להיות גבוה בבודדים. נכשל בשקט: מחזיר null.
 */
export async function warmTodayCount(sb: any): Promise<number | null> {
  try {
    // תגובות שממתינות למענה: אותו תנאי כמו הבאנר במסך מכרים. 23.11.2026 שאול ראה
    // שתי תגובות במסך והאריח אמר 0, כי הוא ספר רק הגשות של היום.
    const rep = await sb.from('contacts').select('id', { count: 'exact', head: true })
      .not('replied_at', 'is', null).is('reply_done_at', null);
    if (rep.error) return null;
    const replies = rep.count ?? 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data: rows, error } = await sb.from('applications')
      .select('job_id, sent_at, company, jobs(company)')
      .gte('sent_at', start.toISOString());
    if (error) return null;
    const byJob = new Map<string, string>();
    for (const a of (rows ?? []) as any[]) {
      const k = companyKey(a.jobs?.company ?? a.company ?? '');
      if (k && a.job_id) byJob.set(a.job_id, k);
    }
    if (!byJob.size) return replies;
    const contacts = await contactsByCompanyKeys(
      sb, [...new Set(byJob.values())], 'id, company_key, contacted_at, skipped_at, left_company_at');
    const open = new Set<string>();
    for (const c of contacts as any[]) {
      if (c.contacted_at || c.skipped_at || c.left_company_at) continue;
      const k = (c.company_key ?? '').trim();
      if (k) open.add(k);
    }
    let n = 0;
    for (const k of byJob.values()) if (open.has(k)) n++;
    return n + replies;
  } catch { return null; }
}
