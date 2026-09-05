import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const OPEN = ['/login', '/auth/callback'];

// The way back in if the profile gate ever gets it wrong. Not the access rule —
// that is the profile — just the one address that cannot be shut out by a bug
// in the rule. Unset it once this has run for a while without needing it.
const EMERGENCY_OWNER = process.env.OWNER_EMAIL ?? 'shaul.mano@gmail.com';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;
  const open = OPEN.some((p) => path.startsWith(p));

  // A profile is what admits a person, not a hardcoded address.
  //
  // This used to compare against OWNER_EMAIL, which was right while the system
  // had exactly one user and wrong the moment it had two. Being authenticated
  // still admits nobody: Supabase will issue a session to any address it has an
  // account for, including seven left over from an abandoned scaffold, so the
  // question asked here is whether this person was invited.
  //
  // redeem_invite() turns a waiting invitation into a profile, matched on the
  // caller's own verified email claim and running as its owner because an
  // uninvited caller cannot be allowed to read the invites table at all.
  if (user && !open) {
    const { data: profile, error } = await sb
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    // Fail open, and only here. A network blip or a policy mistake must not
    // lock the owner out of his own app with no way back in — the door being
    // briefly too generous is recoverable, the door jamming shut is not, and
    // every table underneath still refuses to hand this session anyone else's
    // rows. Only a definite "no such profile, and no invitation either" denies.
    if (!error && !profile) {
      const { data: admitted } = await sb.rpc('redeem_invite');
      if (!admitted && user.email !== EMERGENCY_OWNER) {
        await sb.auth.signOut();
        return NextResponse.redirect(new URL('/login?denied=1', req.url));
      }
    }
  }
  if (!user && !open) return NextResponse.redirect(new URL('/login', req.url));
  if (user && path === '/login') return NextResponse.redirect(new URL('/', req.url));

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|webp)$).*)'],
};
