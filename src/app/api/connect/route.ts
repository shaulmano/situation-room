import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * "מגייסים לפי משרה": סימון ברמת החברה, ביקשתי או ויתור. ראה
 * migration 0083. לא נשמר אף שם של אדם.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const key = typeof b?.companyKey === 'string' ? b.companyKey : '';
  const company = typeof b?.company === 'string' ? b.company : '';
  if (!key || !company || !(b?.asked === true || b?.skipped === true)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const { error } = await serverClient().from('job_connect_asks').upsert({
    company_key: key,
    company,
    job_id: typeof b?.jobId === 'string' ? b.jobId : null,
    ...(b.asked ? { asked_at: now } : { skipped_at: now }),
  }, { onConflict: 'company_key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
