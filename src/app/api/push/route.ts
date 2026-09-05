import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { currentUser, unauthorized } from '@/lib/auth';

// One row per device. The endpoint is the identity Apple and Google hand out,
// so re-subscribing on the same phone updates rather than piles up.
//
// The row carries a user: an alert says "four jobs matched you", and sending
// one person's matches to another person's phone is the quietest kind of leak
// there is — nobody reports it, they just see jobs that make no sense.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: 'missing subscription' }, { status: 400 });
  }

  const { error } = await serverClient().from('push_subscriptions').upsert(
    {
      user_id: user.id,
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
  const user = await currentUser();
  if (!user) return unauthorized();

  const { endpoint } = await req.json().catch(() => ({ endpoint: null }));
  if (!endpoint) return NextResponse.json({ error: 'missing endpoint' }, { status: 400 });

  // Scoped to the caller as well as to the endpoint. An endpoint is a long
  // opaque string and not a secret — it is handed to any page that asks the
  // browser for it — so on its own it is a weak thing to delete rows by.
  await serverClient()
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { data } = await serverClient()
    .from('push_subscriptions')
    .select('endpoint, label, created_at, last_ok, failures')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ subscriptions: data ?? [] });
}
