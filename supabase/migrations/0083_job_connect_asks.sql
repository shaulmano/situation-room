-- 26.11.2026. "מגייסים לפי משרה": חברה עם משרה פתוחה שמתאימה לשאול ובלי
-- אף איש קשר שלו. הסימון ברמת החברה ולא ברמת אדם: שום שם של אדם לא נשמר
-- כאן, רק החלטה של שאול ("ביקשתי" או "מוותר") והמשרה שעליה נכתבה ההערה.
create table if not exists job_connect_asks (
  company_key text primary key,
  company text not null,
  job_id uuid,
  asked_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now()
);
alter table job_connect_asks enable row level security;
drop policy if exists owner_only on job_connect_asks;
create policy owner_only on job_connect_asks for all
  using (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com')
  with check (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com');
notify pgrst, 'reload schema';
