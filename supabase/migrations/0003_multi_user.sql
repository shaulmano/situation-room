-- Multi-tenancy, applied without taking the running app down.
--
-- Every change here is additive. user_id columns arrive nullable and are
-- backfilled to the existing owner; the policies gain a `user_id = auth.uid()`
-- arm *beside* the hardcoded-email one rather than replacing it, so the version
-- of the app that is live right now keeps working while the new one is built.
-- The email arm comes out in 0004, once the new app has proven itself.
--
-- The 13 abandoned Hermeticon tables that used to share this project were
-- dropped on 05/09, so `profiles` is a free name again and nothing here
-- collides with a table it did not create.

-- ── profiles: one row per person, and the invite gate ──────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  -- Scoring is per person: "near" means near *you*. Shaul's commute from Rosh
  -- HaAyin is a constant in score.py today; it becomes this column.
  home_area    text,
  is_owner     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Sign-up is invite-only: an unknown address can authenticate with Supabase but
-- has no profile, and every policy below keys off this table.
create table if not exists invites (
  code       text primary key,
  email      text,
  created_by uuid references auth.users(id) on delete set null,
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

-- By email, not by a pasted uuid. The account was created 03/06 and survived
-- the cleanup; hardcoding its id here would be one transcription away from
-- silently making nobody the owner.
insert into profiles (id, email, display_name, is_owner)
select id, email, 'Shaul', true from auth.users where email = 'shaul.mano@gmail.com'
on conflict (id) do update set is_owner = true;

-- ── a person's own searches ────────────────────────────────────────────────
-- The scrapers do NOT run per user. They sweep the same 12 sources once and
-- carry the union of every active search's terms, because ten users each
-- triggering their own crawl is what gets us blocked — Indeed is already lost
-- that way, and Malam and SQLink only answer from an Israeli address.
create table if not exists searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- What the person actually typed, kept verbatim and never overwritten: a bad
  -- expansion has to be fixable without losing the intent behind it.
  label       text not null,
  -- What that was turned into, and what the scrapers are actually asked for.
  terms       text[] not null default '{}',
  locations   text[] not null default '{}',
  seniority   text,
  expanded_by text,          -- 'dictionary' | 'claude'
  expanded_at timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists searches_active_idx on searches(user_id) where active;

-- ── what matched whom ──────────────────────────────────────────────────────
-- Deliberately NOT a replacement for `matches`. That table is keyed
-- (job_id, cv_id) against Shaul's three CVs and every one of his screens joins
-- it; swapping it out here would break the app on his phone the moment this
-- runs. Both live side by side until the screens have moved. `matches` is
-- dropped in 0004.
--
-- user_id is denormalised from searches on purpose: it makes the policy a
-- column comparison instead of a subquery on every row read.
create table if not exists search_matches (
  search_id  uuid not null references searches(id) on delete cascade,
  job_id     text not null references jobs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- In or out is the decision the feed actually needs. The score is kept as a
  -- hint to display, not as something anything sorts by or maintains: Shaul
  -- opens every row, so ranking earns nothing and re-scoring earns nothing.
  score      int check (score between 0 and 100),
  reasons    text[],
  matched_at timestamptz not null default now(),
  primary key (search_id, job_id)
);
create index if not exists search_matches_user_idx on search_matches(user_id, matched_at desc);

-- ── dismissals are personal ────────────────────────────────────────────────
-- One person hiding a posting must not remove it from everyone else's feed.
create table if not exists job_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  job_id       text not null references jobs(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

-- ── tenancy on what is personal ────────────────────────────────────────────
alter table cvs                add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table applications       add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table events             add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table outreach           add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table push_subscriptions add column if not exists user_id uuid references auth.users(id) on delete cascade;

do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where email = 'shaul.mano@gmail.com';
  if owner_id is null then
    raise exception 'owner account not found — refusing to leave rows unowned';
  end if;

  update cvs                set user_id = owner_id where user_id is null;
  update applications       set user_id = owner_id where user_id is null;
  update events             set user_id = owner_id where user_id is null;
  update outreach           set user_id = owner_id where user_id is null;
  update push_subscriptions set user_id = owner_id where user_id is null;

  insert into job_dismissals (user_id, job_id, dismissed_at)
  select owner_id, id, dismissed_at from jobs where dismissed_at is not null
  on conflict do nothing;
end $$;

create index if not exists applications_user_idx on applications(user_id);

-- ── the two columns that stop the feed hiding things ───────────────────────
--
-- `created_at` already records when a row entered THIS database — the upsert
-- conflicts on url and never touches it again — so it is the arrival time and
-- no new column is needed. What was missing is that the feed filters on
-- `first_seen`, the bot's discovery time, which comes from jobs.jsonl and is
-- absent on 145 LinkedIn rows. `>=` is never true for NULL, so those 145 are
-- on target, undismissed, scored — and invisible in every view except ?all=1.
--
-- Backfilled to the honest fallback: we do not know when it was found, we know
-- when it got here. The screens move to created_at in the same change that cuts
-- the sync schedule — until they do, a long outage could still land jobs that
-- are already older than the window.
update jobs set first_seen = created_at where first_seen is null;
create index if not exists jobs_created_idx on jobs(created_at desc);

-- Scoring only what changed needs to know what changed. A plain
-- `updated_at = now()` on every update would be useless here: the sync upserts
-- all ~1,000 rows every run and bumps last_seen on each, so the column would
-- move constantly and mark everything dirty. Only the fields that can change a
-- match count.
alter table jobs add column if not exists updated_at timestamptz;
update jobs set updated_at = coalesce(updated_at, created_at);

create or replace function jobs_touch() returns trigger as $$
begin
  if new.description is distinct from old.description
     or new.title    is distinct from old.title
     or new.company  is distinct from old.company
     or new.location is distinct from old.location then
    new.updated_at = now();
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists jobs_touch_trg on jobs;
create trigger jobs_touch_trg before update on jobs
  for each row execute function jobs_touch();

-- ── policies ───────────────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table invites  enable row level security;

drop policy if exists own_profile on profiles;
create policy own_profile on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Invites are the owner's to hand out. A recipient never reads this table:
-- redemption goes through a security-definer function, so codes cannot be
-- enumerated by anyone holding a valid session.
drop policy if exists owner_invites on invites;
create policy owner_invites on invites for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner));

do $$
declare t text;
begin
  foreach t in array array['cvs','applications','events','outreach',
                           'push_subscriptions','searches','search_matches',
                           'job_dismissals']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_only on %I', t);
    execute format('drop policy if exists tenant on %I', t);
    -- Both arms during the transition: auth.uid() for the new app, the email
    -- for the one currently serving Shaul's phone. 0004 drops the email arm.
    execute format($f$
      create policy tenant on %I
      for all to authenticated
      using (user_id = auth.uid()
             or (auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
      with check (user_id = auth.uid()
                  or (auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
    $f$, t);
  end loop;
end $$;

-- Market data: readable by anyone signed in, because a posting on AllJobs is
-- not anyone's private information. What is private is *that you are looking* —
-- and that lives in search_matches, applications and job_dismissals, above.
--
-- Writes stay with the owner for now: the dismiss route still sets
-- jobs.dismissed_at, and the scanners write through the Management API, which
-- is superuser and bypasses policies entirely. The owner write arm goes away in
-- 0004 together with jobs.dismissed_at itself.
do $$
declare t text;
begin
  foreach t in array array['jobs','scans','scan_runs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_only on %I', t);
    execute format('drop policy if exists read_all on %I', t);
    execute format('drop policy if exists owner_writes on %I', t);
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
    execute format($f$
      create policy owner_writes on %I
      for all to authenticated
      using ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
      with check ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
    $f$, t);
  end loop;
end $$;

-- `matches` is untouched and stays owner-only until 0004 retires it.
