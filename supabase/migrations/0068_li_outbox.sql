-- 22.11.2026: תור שליחה של הודעות לינקדאין. שאול מסמן במסך, והסקריפט
-- במחשב שלו (send_outbox.py, דפדפן אמיתי) שולח ומסמן כאן. בלי שליחה
-- מהענן: לינקדאין חוסמת את הראנר.
create table if not exists li_outbox (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  profile_url text not null,
  to_name text,
  message text not null,
  cv_file text,
  job_id text,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  error text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists li_outbox_status_idx on li_outbox (status, queued_at);
alter table li_outbox enable row level security;
drop policy if exists owner_only on li_outbox;
create policy owner_only on li_outbox for all
  using (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com')
  with check (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com');
notify pgrst, 'reload schema';
