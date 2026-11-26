import { serverClient } from '@/lib/server';
import { loadClients } from '@/lib/clients';
import ClientsTable from '@/components/ClientsTable';

export const dynamic = 'force-dynamic';

/**
 * לקוחות: המסך שממנו עובדים. 26.11.2026, שאול: "כל מידע קיים, זה רק איך
 * להציג". ראה src/lib/clients: אין כתיבה, והסטטוסים מחושבים בכל טעינה.
 */
export default async function Clients({ searchParams }: { searchParams?: { waiting?: string; group?: string; replied?: string } }) {
  const sb = serverClient();
  const { clients, error } = await loadClients(sb);
  return (
    <>
      <div className="hx-top"><h1>לקוחות</h1><span className="mut">מגייסות, HR ומנהלי פיתוח, והמשרות בחברות שלהם</span></div>
      {error && <div className="hx-err">שגיאה בשליפה: {error}</div>}
      <ClientsTable clients={clients} initial={{
        waiting: searchParams?.waiting === '1',
        replied: searchParams?.replied === '1',
        group: ['recruiter', 'dev', 'other'].includes(searchParams?.group ?? '') ? (searchParams!.group as 'recruiter' | 'dev' | 'other') : undefined,
      }} />
    </>
  );
}
