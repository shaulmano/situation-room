-- Redemption, and why it is a function rather than a policy.
--
-- An invited person arrives holding a valid session and nothing else: no
-- profile, and no way to read `invites` — that table is owner-only precisely so
-- that a signed-in stranger cannot enumerate the codes in it. So they cannot
-- check their own invite, and they certainly cannot insert their own profile;
-- a policy permissive enough to let them do it would be permissive enough to
-- let anyone mint a profile and walk in.
--
-- The way out is a function that runs as its owner, not as the caller. It reads
-- one row, matched on the caller's own verified email claim, and either creates
-- exactly one profile or does nothing at all. The caller never sees the table,
-- cannot pass an email that is not theirs, and cannot reach any other row.

create or replace function redeem_invite()
returns boolean
language plpgsql
security definer
-- Pin the search path: a security-definer function that resolves names through
-- the caller's search_path can be pointed at a table the caller controls.
set search_path = public, pg_temp
as $$
declare
  uid   uuid := auth.uid();
  mail  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv   invites%rowtype;
begin
  if uid is null or mail = '' then
    return false;
  end if;

  -- Already admitted. Not an error, and not a second invite either: this runs
  -- on every page load for a signed-in person.
  if exists (select 1 from profiles where id = uid) then
    return true;
  end if;

  select * into inv
  from invites
  where lower(email) = mail
    and used_by is null
    and expires_at > now()
  order by created_at
  limit 1;

  if not found then
    return false;
  end if;

  insert into profiles (id, email, display_name, is_owner)
  values (uid, mail, split_part(mail, '@', 1), false)
  on conflict (id) do nothing;

  update invites
     set used_by = uid, used_at = now()
   where code = inv.code;

  return true;
end $$;

revoke all on function redeem_invite() from public;
grant execute on function redeem_invite() to authenticated;

-- The owner needs to see who is in, which means reading rows in `profiles` that
-- are not their own — exactly what own_profile forbids. A view was the obvious
-- way and the wrong one: a Postgres view runs as its definer unless it is
-- declared security_invoker, so `select * from people` would have handed every
-- profile to every signed-in caller, policies and all. A second SELECT policy
-- on the table itself keeps the rule where the rows are.
--
-- Its own subquery has to bypass RLS or the policy on profiles would consult
-- profiles and recurse, so the ownership test is a security-definer function.
create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_owner from profiles where id = auth.uid()), false);
$$;

revoke all on function is_owner() from public;
grant execute on function is_owner() to authenticated;

drop policy if exists owner_reads_people on profiles;
create policy owner_reads_people on profiles
  for select to authenticated
  using (id = auth.uid() or is_owner());

-- What the owner sees stops at who and when. Not their searches, not their
-- applications, not what they were shown — those tables key on user_id and stay
-- keyed on it. Owning the system is not managing the people in it.
--
-- Same function on invites, replacing the inline subquery from 0003: one
-- definition of "is the owner", so tightening it later cannot miss a copy.
drop policy if exists owner_invites on invites;
create policy owner_invites on invites for all to authenticated
  using (is_owner()) with check (is_owner());

-- Removing a person takes their data with them, in one statement that either
-- happens or does not.
--
-- Deleting the profile alone only locks the door: the cascades on these tables
-- hang off auth.users, not off profiles, so their searches would keep costing
-- scan time and their applications would stay on file for a person who is no
-- longer here. Doing it from the app would work today only because the owner
-- still carries the transitional email arm in every policy — the arm 0006
-- deletes. This does not depend on that.
create or replace function remove_person(target uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_owner() then
    raise exception 'not permitted';
  end if;
  if target = auth.uid() then
    raise exception 'refusing to remove the owner';
  end if;

  delete from search_matches     where user_id = target;
  delete from searches           where user_id = target;
  delete from job_dismissals     where user_id = target;
  delete from push_subscriptions where user_id = target;
  delete from applications       where user_id = target;
  delete from cvs                where user_id = target;
  delete from outreach           where user_id = target;
  delete from invites            where used_by = target;
  delete from profiles           where id = target;
  return true;
end $$;

revoke all on function remove_person(uuid) from public;
grant execute on function remove_person(uuid) to authenticated;
