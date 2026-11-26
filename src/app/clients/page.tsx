import { serverClient } from '@/lib/server';
import { loadClients } from '@/lib/clients';
import CrmShell from '@/components/CrmShell';
import ClientsTable from '@/components/ClientsTable';
import './clients.css';

export const dynamic = 'force-dynamic';

/**
 * לקוחות: המסך שממנו עובדים. 26.11.2026, שאול: "כל מידע קיים, זה רק איך
 * להציג". ראה src/lib/clients: אין כתיבה, והסטטוסים מחושבים בכל טעינה.
 */
export default async function Clients() {
  const sb = serverClient();
  const { clients, error } = await loadClients(sb);
  return (
    <CrmShell>
      <div className="hx-top"><h1>לקוחות</h1><span className="mut">מגייסות, HR ומנהלי פיתוח, והמשרות בחברות שלהם</span></div>
      {error && <div className="hx-err">שגיאה בשליפה: {error}</div>}
      <ClientsTable clients={clients} />
    </CrmShell>
  );
}
