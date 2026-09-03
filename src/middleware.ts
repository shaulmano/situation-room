import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const OWNER = process.env.OWNER_EMAIL ?? 'shaul.mano@gmail.com';
const OPEN = ['/login', '/auth/callback'];

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

  // Only the owner gets in. Anyone else who authenticates is signed straight out.
  if (user && user.email !== OWNER) {
    await sb.auth.signOut();
    return NextResponse.redirect(new URL('/login?denied=1', req.url));
  }
  if (!user && !open) return NextResponse.redirect(new URL('/login', req.url));
  if (user && path === '/login') return NextResponse.redirect(new URL('/', req.url));

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|webp)$).*)'],
};
