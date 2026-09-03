-- חדר המצב · schema
-- Single-user personal job-search system. Owner: shaul.mano@gmail.com

create table if not exists jobs (
  id           text primary key,
  title        text not null,
  company      text,
  source       text not null,
  url          text,
  location     text,
  posted       date,
  first_seen   timestamptz,
  last_seen    timestamptz,
  description  text,
  industry     text,
  on_target    boolean default false,
  created_at   timestamptz default now()
);
create index if not exists jobs_source_idx    on jobs(source);
create index if not exists jobs_firstseen_idx on jobs(first_seen desc);

create table if not exists cvs (
  id           text primary key,
  label        text not null,
  filename     text,
  target_roles text[],
  content      text,
  updated_at   timestamptz default now()
);

create table if not exists matches (
  job_id     text not null references jobs(id) on delete cascade,
  cv_id      text not null references cvs(id)  on delete cascade,
  score      int  not null check (score between 0 and 100),
  stage      text not null default 'rule',
  dimensions jsonb,
  reasons    text[],
  red_flags  text[],
  scored_at  timestamptz default now(),
  primary key (job_id, cv_id)
);
create index if not exists matches_score_idx on matches(score desc);

create table if not exists applications (
  id               uuid primary key default gen_random_uuid(),
  job_id           text references jobs(id) on delete set null,
  cv_id            text references cvs(id),
  company          text,
  role             text,
  channel          text not null default 'email',
  recipient        text,
  gmail_thread_id  text unique,
  sent_at          timestamptz not null,
  status           text not null default 'sent',
  created_at       timestamptz default now()
);
create index if not exists apps_sentat_idx on applications(sent_at desc);
create index if not exists apps_status_idx on applications(status);

create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  kind           text,
  received_at    timestamptz,
  from_addr      text,
  subject        text,
  snippet        text,
  classification text,
  classified_by  text default 'auto',
  created_at     timestamptz default now()
);
create index if not exists events_recv_idx on events(received_at desc);

create table if not exists outreach (
  id         uuid primary key default gen_random_uuid(),
  org        text not null,
  contact    text,
  role       text,
  channel    text,
  called_at  timestamptz,
  outcome    text,
  next_at    date,
  notes      text,
  created_at timestamptz default now()
);

create table if not exists scans (
  id        uuid primary key default gen_random_uuid(),
  ran_at    timestamptz not null default now(),
  source    text not null,
  raw       int default 0,
  on_target int default 0,
  fresh     int default 0,
  failed    boolean default false,
  reason    text
);
create index if not exists scans_ranat_idx on scans(ran_at desc);

-- ── RLS: one owner, by email claim. Never qual=true. ──────────────────
do $$
declare t text;
begin
  foreach t in array array['jobs','cvs','matches','applications','events','outreach','scans']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_only on %I', t);
    execute format($f$
      create policy owner_only on %I
      for all to authenticated
      using ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
      with check ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
    $f$, t);
  end loop;
end $$;
