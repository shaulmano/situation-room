import { serverClient } from '@/lib/server';
import { loadClients } from '@/lib/clients';
import ClientsTable from '@/components/ClientsTable';
import { peopleAtCompanyHref } from '@/lib/contacts';

export const dynamic = 'force-dynamic';

/**
 * לקוחות: המסך שממנו עובדים. 26.11.2026, שאול: "כל מידע קיים, זה רק איך
 * להציג". ראה src/lib/clients: אין כתיבה, והסטטוסים מחושבים בכל טעינה.
 */
export default async function Clients({ searchParams }: { searchParams?: { waiting?: string; group?: string; replied?: string } }) {
  const sb = serverClient();
  const { clients, orphans, error } = await loadClients(sb);
  return (
    <>
      <div className="hx-top"><h1>לקוחות</h1><span className="mut">מגייסות, HR ומנהלי פיתוח, והמשרות בחברות שלהם</span></div>
      {error && <div className="hx-err">שגיאה בשליפה: {error}</div>}
      <ClientsTable clients={clients} initial={{
        waiting: searchParams?.waiting === '1',
        replied: searchParams?.replied === '1',
        group: ['recruiter', 'dev', 'other'].includes(searchParams?.group ?? '') ? (searchParams!.group as 'recruiter' | 'dev' | 'other') : undefined,
      }} />
      {orphans.length > 0 && (
        <details className="hx-orph" title="חברות שיש בהן משרה פתוחה ומתאימה ואין בהן אף איש קשר או מגייס. הקישור פותח חיפוש בלינקדאין.">
          <summary>חברות בלי איש קשר ({orphans.length})</summary>
          <p className="mut">יש בהן משרה פתוחה ומתאימה, ואין שם אף מגייס, HR או מנהל פיתוח. החיפוש נפתח בלינקדאין בלשונית חדשה.</p>
          {orphans.map((o) => {
            const href = o.company.startsWith('ללא שם חברה') ? null : peopleAtCompanyHref(o.company, o.jobs[0].title);
            return (
              <div key={o.company} className="hx-orph-row">
                <b>{o.company}</b>
                <span className="mut">{o.jobs.length} משרות</span>
                <div className="hx-orph-acts">
                  {o.jobs.slice(0, 3).map((j) => j.url
                    ? <a key={j.id} className="cn-b" href={j.url} target="_blank" rel="noreferrer" title={j.title}>{j.title}</a>
                    : <span key={j.id} className="mut">{j.title}</span>)}
                  {href && <a className="cn-b main" href={href} target="_blank" rel="noreferrer" title="חיפוש אנשים בחברה בלינקדאין">חפש מגייסים</a>}
                </div>
              </div>
            );
          })}
        </details>
      )}
    </>
  );
}
