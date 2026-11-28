import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/server';
import { loadClients } from '@/lib/clients';

export const dynamic = 'force-dynamic';

// המספרים על טאבי התפריט (28.11.2026, שאול: "מספר על הטאב אם יש שם דברים חדשים").
// אותו חישוב בדיוק כמו מסך המטלות: לקוחות שמחכים לפעולה, ותגובות שלא טופלו.
export async function GET() {
  const sb = serverClient();
  const [cl, rep] = await Promise.all([
    loadClients(sb),
    sb.from('contacts').select('id', { count: 'exact', head: true })
      .not('replied_at', 'is', null).is('reply_done_at', null),
  ]);
  const waiting = cl.error ? null : cl.clients.filter((c) => !!c.next && !c.next.startsWith('מחכה')).length;
  return NextResponse.json({ clients: waiting, replies: rep.error ? null : (rep.count ?? 0) });
}
