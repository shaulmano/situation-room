import { NextResponse } from 'next/server';
import { serverClient } from './server';

/**
 * Who is calling, asked once per request.
 *
 * The middleware already sends a signed-out browser to /login, but it guards
 * *pages*. A POST reaches these routes without ever passing a redirect, so a
 * button hidden in the UI is not a permission — it is a disguise. Every route
 * below asks here first.
 *
 * RLS still stands underneath all of it, and still would have stopped a cross
 * -tenant read. What it cannot express is "only the owner may spend twenty
 * minutes of the month's CI budget": that is not a row, so no row policy can
 * hold it. That check has to live in the route.
 */
export type Caller = { id: string; email: string | null; isOwner: boolean };

export async function currentUser(): Promise<Caller | null> {
  const sb = serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const read = () =>
    sb.from('profiles').select('is_owner').eq('id', user.id).maybeSingle();

  let { data: profile } = await read();

  // No profile yet. Either an invitation is waiting for this address, or the
  // account is left over from something else — seven of those were sitting on
  // this project in September, from a scaffold abandoned in June. Authenticated
  // has never been the same thing as admitted.
  //
  // redeem_invite() is the only path from one to the other: it runs as its
  // owner, matches on the caller's own verified email claim, and creates at most
  // one profile. It cannot be aimed at anyone else's invitation, and it returns
  // false rather than failing when there is nothing to redeem.
  if (!profile) {
    const { data: admitted } = await sb.rpc('redeem_invite');
    if (admitted) ({ data: profile } = await read());
  }

  return profile
    ? { id: user.id, email: user.email ?? null, isOwner: profile.is_owner === true }
    : null;
}

export const unauthorized = () =>
  NextResponse.json({ error: 'לא מחובר' }, { status: 401 });

export const forbidden = (why = 'אין הרשאה') =>
  NextResponse.json({ error: why }, { status: 403 });
