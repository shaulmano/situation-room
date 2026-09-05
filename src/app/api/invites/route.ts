import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/server';
import { currentUser, unauthorized, forbidden } from '@/lib/auth';

// Invites are bound to an address, not handed out as a code.
//
// A code is a bearer token: whoever holds it is in, including whoever it was
// forwarded to. Binding to the email means the invite is worthless to anyone
// else — redeem_invite() matches on the caller's own verified email claim, so
// there is nothing to forward and nothing to guess. The code column stays as
// the row's identity, never as a secret.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (!user.isOwner) return forbidden('רק בעל המערכת מזמין משתמשים');

  const { email } = await req.json().catch(() => ({}));
  const mail = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return NextResponse.json({ error: 'כתובת לא תקינה' }, { status: 400 });
  }

  const sb = serverClient();

  const { data: already } = await sb
    .from('profiles')
    .select('id')
    .eq('email', mail)
    .maybeSingle();
  if (already) return NextResponse.json({ error: 'כבר משתמש במערכת' }, { status: 409 });

  const { data: open } = await sb
    .from('invites')
    .select('code')
    .eq('email', mail)
    .is('used_by', null)
    .maybeSingle();
  if (open) return NextResponse.json({ ok: true, already: true });

  const { error } = await sb.from('invites').insert({
    code: crypto.randomUUID(),
    email: mail,
    created_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET — who is in, and who has been invited and has not arrived.
//
// Deliberately thin. The owner sees an address, a join date, and how many
// searches someone is running — the last only because active terms are what a
// scan costs and that is a shared resource. Not which postings they were shown,
// not where they applied, not what came back. Owning the system is not managing
// the people in it.
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (!user.isOwner) return forbidden();

  const sb = serverClient();

  const { data: people } = await sb
    .from('profiles')
    .select('id, email, display_name, is_owner, created_at')
    .order('created_at');

  const { data: pending } = await sb
    .from('invites')
    .select('code, email, created_at, expires_at')
    .is('used_by', null)
    .order('created_at', { ascending: false });

  const counts = await Promise.all(
    (people ?? []).map(async (p) => {
      const { count } = await sb
        .from('searches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', p.id)
        .eq('active', true);
      return count ?? 0;
    })
  );

  return NextResponse.json({
    people: (people ?? []).map((p, i) => ({ ...p, searches: counts[i] })),
    pending: (pending ?? []).filter((v) => new Date(v.expires_at) > new Date()),
  });
}

// DELETE — withdraw an invitation that has not been used, or remove a person.
export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (!user.isOwner) return forbidden('רק בעל המערכת מסיר משתמשים');

  const { code, id } = await req.json().catch(() => ({}));
  const sb = serverClient();

  if (code) {
    const { error } = await sb.from('invites').delete().eq('code', code).is('used_by', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (id) {
    if (id === user.id) {
      return NextResponse.json({ error: 'אי אפשר להסיר את עצמך' }, { status: 400 });
    }
    // Through the function, not a delete on profiles. Removing the profile only
    // locks the door: the cascades hang off auth.users, so their searches would
    // keep costing scan time and their applications would stay on file. The
    // function takes the rows with the person, in one transaction, and checks
    // ownership itself rather than trusting this route to have done it.
    const { error } = await sb.rpc('remove_person', { target: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'missing code or id' }, { status: 400 });
}
