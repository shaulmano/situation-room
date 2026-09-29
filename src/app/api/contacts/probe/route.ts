import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { companyKey } from '@/lib/contacts';

export const dynamic = 'force-dynamic';

// A single company, looked up exactly the way the job screens look it up, so
// that a miss can be told apart from an error without guessing.
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get('company') ?? '';
  const key = companyKey(raw);
  const sb = serverClient();

  const byKey = await sb
    .from('contacts')
    .select('id, full_name, title, linkedin_url, email, phone, contacted_at, company_key')
    .in('company_key', [key]);
  const total = await sb.from('contacts').select('id', { count: 'exact', head: true });

  return NextResponse.json({
    raw,
    key,
    rows: byKey.data?.length ?? 0,
    first: byKey.data?.[0] ?? null,
    error: byKey.error?.message ?? null,
    total: total.count ?? 0,
  });
}
