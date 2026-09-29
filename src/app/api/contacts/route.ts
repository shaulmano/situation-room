import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { parseConnections } from '@/lib/linkedin-csv';
import { companyKey } from '@/lib/contacts';

export const dynamic = 'force-dynamic';

const BATCH = 400;

// GET, how many contacts there are and when they last came in. The home
// screen turns the date into the reminder.
export async function GET() {
  const sb = serverClient();
  const [total, last] = await Promise.all([
    sb.from('contacts').select('id', { count: 'exact', head: true }),
    sb.from('contacts').select('imported_at').order('imported_at', { ascending: false }).limit(1),
  ]);
  return NextResponse.json({
    count: total.count ?? 0,
    last: last.data?.[0]?.imported_at ?? null,
  });
}

// POST, one LinkedIn connections export, merged in.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const csv = typeof (body as { csv?: unknown })?.csv === 'string' ? (body as { csv: string }).csv : '';
  if (!csv.trim()) {
    return NextResponse.json({ error: 'לא התקבל קובץ' }, { status: 400 });
  }

  const parsed = parseConnections(csv);
  if (parsed.length === 0) {
    return NextResponse.json(
      { error: 'לא נמצאו אנשי קשר בקובץ. צריך את Connections.csv מהייצוא של לינקדאין.' },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();
  // The same person can appear twice in one export. Postgres refuses to let a
  // single statement touch a row twice, so the duplicates go before the insert
  // and not after it.
  const seen = new Set<string>();
  const rows: Record<string, string | null>[] = [];
  for (const c of parsed) {
    const key = (c.linkedin_url || `${c.full_name}|${c.company ?? ''}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      full_name: c.full_name,
      company: c.company,
      company_key: companyKey(c.company),
      title: c.title,
      linkedin_url: c.linkedin_url,
      email: c.email,
      connected_on: c.connected_on,
      imported_at: now,
      updated_at: now,
    });
  }

  // An export where the email is blank would otherwise erase an address an
  // earlier export did carry, so those rows are sent without the column at all.
  const withEmail = rows.filter((r) => r.email);
  const withoutEmail = rows
    .filter((r) => !r.email)
    .map(({ email, ...rest }) => rest);

  const sb = serverClient();
  let saved = 0;
  for (const group of [withEmail, withoutEmail]) {
    for (let i = 0; i < group.length; i += BATCH) {
      const chunk = group.slice(i, i + BATCH);
      if (chunk.length === 0) continue;
      const { error } = await sb.from('contacts').upsert(chunk, { onConflict: 'dedupe_key' });
      if (error) {
        return NextResponse.json({ error: error.message, saved }, { status: 500 });
      }
      saved += chunk.length;
    }
  }

  return NextResponse.json({ ok: true, saved, withEmail: withEmail.length });
}

// PATCH, a phone number or a note typed on the job screen. Never touched by an
// import, which is the whole point of keeping them in separate columns.
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { id?: unknown; phone?: unknown; note?: unknown; contacted?: unknown }
    | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (typeof body?.phone === 'string') patch.phone = body.phone.trim() || null;
  if (typeof body?.note === 'string') patch.note = body.note.trim() || null;
  // Marking an outreach is a timestamp, not a flag: the job screen shows how
  // long ago it was, which is what decides whether to follow up.
  if (typeof body?.contacted === 'boolean') {
    patch.contacted_at = body.contacted ? new Date().toISOString() : null;
  }

  const { error } = await serverClient().from('contacts').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
