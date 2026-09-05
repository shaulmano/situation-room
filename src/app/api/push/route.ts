import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

// One row per device. The endpoint is the identity Apple and Google hand out,
// so re-subscribing on the same phone updates rather than piles up.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: 'missing subscription' }, { status: 400 });
  }

  const { error } = await serverClient().from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      label: body.label ?? null,
      failures: 0,
    },
    { onConflict: 'endpoint' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json().catch(() => ({ endpoint: null }));
  if (!endpoint) return NextResponse.json({ error: 'missing endpoint' }, { status: 400 });
  await serverClient().from('push_subscriptions').delete().eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { data } = await serverClient()
    .from('push_subscriptions')
    .select('endpoint, label, created_at, last_ok, failures')
    .order('created_at', { ascending: false });
  return NextResponse.json({ subscriptions: data ?? [] });
}
