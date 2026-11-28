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
  // המסך "תשובות" מציג סטטוסים מהמייל ולא תגובות מלינקדאין, ולכן אין עליו מספר. תגובה שמחכה היא בלקוחות. 28.11.2026: המספר על הטאב הוא רק דחוף, כלומר מי שענה ומי שאישר חברות וממתין למכתב. כל השאר נשאר בתוך המסך.
  return NextResponse.json({ clients: cl.error ? null : list.length, urgent: list.filter((c) => c.urgent || (c.acceptedAt && c.next?.startsWith('לשלוח'))).length, replied: list.filter((c) => c.urgent).length });
}
