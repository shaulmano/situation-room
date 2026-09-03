import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (code) await serverClient().auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL('/', req.url));
}
