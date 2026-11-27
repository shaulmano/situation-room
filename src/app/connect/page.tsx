import Link from 'next/link';
import { serverClient } from '@/lib/server';
import ConnectList, { type ConnectRow } from '@/components/ConnectList';
import { goldConnectNote } from '@/lib/gold';
import ConnectJobs from '@/components/ConnectJobs';
import { loadJobConnect, JOB_CONNECT_DAILY } from '@/lib/jobConnect';

export const dynamic = 'force-dynamic';

/**
 * בקשות חברות למגייסים שאינם בקשרים שלך.
 *
 * 23.11.2026. שאול: "תחפש מגייסות בלינקדאין ותן לי את הרשימה." החיפוש
 * (`find_recruiters.py` במחשב) כותב ל-`gold_recruiters`, והמסך הזה מציג אותם.
 * מסך ייעודי, מטרה אחת: לבקש חברות. אחרי שהוא מאשר, מייל האישור מכניס אותו
 * ל"אישר חברות", ושם יוצא המכתב עם קורות החיים.
 */
export default async function Connect() {
  const sb = serverClient();
  const jc = await loadJobConnect(sb);
  const [{ data: fr, error }, { count: asked }] = await Promise.all([
    sb.from('gold_recruiters')
      .select('id, company_id, full_name, headline, profile_url, found_at')
      .is('contacted_at', null).is('skipped_at', null)
      .order('found_at', { ascending: false }).limit(300),
    sb.from('gold_recruiters').select('id', { count: 'exact', head: true }).not('contacted_at', 'is', null),
  ]);
  const ids = [...new Set((fr ?? []).map((f: any) => f.company_id))];
  const { data: cs } = ids.length
    ? await sb.from('companies').select('id, name, size_class').in('id', ids)
    : { data: [] as any[] };
  const co = new Map((cs ?? []).map((c: any) => [c.id, c]));
  const rows: ConnectRow[] = (fr ?? []).map((f: any) => {
    const c: any = co.get(f.company_id);
    return {
      id: f.id, name: f.full_name, headline: f.headline, url: f.profile_url,
      company: c?.name ?? '', sizeClass: c?.size_class ?? null,
      note: goldConnectNote({ name: f.full_name, company: c?.name ?? '', jobTitle: null }),
    };
  });
  // מהחדש לישן (27.11.2026): השאילתה כבר מסודרת לפי found_at יורד, ולא ממיינים מחדש לפי גודל או שם.

  return (
    <main>
      <div className="head">
        <h1>בקשות חברות</h1>
        <Link className="more" href="/">← חדר המצב</Link>
      </div>
      {error && <div className="alert">שגיאה בשליפה: {error.message}</div>}
      <p className="sub">
        מגייסים ואנשי HR שנמצאו בחברות שאינך מחובר אליהן. <b>העתק הערה</b>, פתח בלינקדאין, שלח בקשת חברות עם ההערה,
        וסמן <b>ביקשתי</b>. כשהוא מאשר, הוא מופיע ב"אישר חברות" וממתין למכתב עם קורות החיים.
        {' '}בקשו כבר: <b>{asked ?? 0}</b>.
      </p>
      <h2>לפי משרה פתוחה</h2>
      <p className="sub">
        חברות שיש בהן משרה שמתאימה לך ואין בהן אף איש קשר שלך. <b>חפש מגייסים</b> פותח חיפוש בלינקדאין באותה חברה,
        <b> העתק הערה</b> נושא את שם המשרה. שום שם לא נשמר כאן. עד {JOB_CONNECT_DAILY} ביום, וגם ויתור נספר.
      </p>
      {jc.error && <div className="alert">שגיאה בשליפה: {jc.error}</div>}
      <ConnectJobs rows={jc.rows} left={jc.left} done={jc.done} quota={JOB_CONNECT_DAILY} />
      <h2>מגייסים שנמצאו</h2>
      <p className="sub">
        מסודר מהחדש לישן לפי מועד שנמצאו. מוצגים {rows.length}{(fr ?? []).length >= 300 ? ' (הראשונים מבין 300 החדשים ביותר)' : ''}.
        {(fr ?? []).length > 0 && ` הכי חדש נמצא ${new Date((fr as any[])[0].found_at).toLocaleDateString('he-IL')}, הכי ישן ${new Date((fr as any[])[(fr as any[]).length - 1].found_at).toLocaleDateString('he-IL')}.`}
      </p>
      <ConnectList rows={rows} />
    </main>
  );
}
