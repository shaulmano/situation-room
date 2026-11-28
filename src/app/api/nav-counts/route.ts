import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/server';
import { loadClients } from '@/lib/clients';

export const dynamic = 'force-dynamic';

// המספרים על טאבי התפריט (28.11.2026, שאול: "מספר על הטאב אם יש שם דברים חדשים").
// אותו חישוב בדיוק כמו מסך המטלות: לקוחות שמחכים לפעולה, וכמה מהם ענו.
export async function GET() {
  const sb = serverClient();
  const cl = await loadClients(sb);
  const list = cl.error ? [] : cl.clients.filter((c) => !!c.next && !c.next.startsWith('מחכה'));
  // המסך "תשובות" מציג סטטוסים מהמייל ולא תגובות מלינקדאין, ולכן אין עליו מספר. תגובה שמחכה היא בלקוחות.
  return NextResponse.json({ clients: cl.error ? null : list.length, urgent: list.filter((c) => c.urgent).length });
}
