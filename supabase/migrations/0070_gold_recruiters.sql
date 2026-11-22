-- 22.11.2026. מגייסים שנמצאו בחיפוש בלינקדאין לחברות זהב שיש בהן משרה
-- פתוחה ומאומתת ואין בהן איש קשר של שאול. טבלה נפרדת מ-contacts בכוונה:
-- אלה לא קשרים שלו אלא אנשים שנמצאו לבקשתו, ואישר זאת במפורש באותו יום
-- ("אני משלם ללינקדאין כל חודש על מנוי פרימיום"). הכלל על מגייסי צד
-- שלישי ב-contacts נשאר כמו שהוא.
create table if not exists gold_recruiters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  full_name text not null,
  headline text,
  profile_url text not null,
  found_at timestamptz not null default now(),
  contacted_at timestamptz,
  skipped_at timestamptz,
  unique (company_id, profile_url)
);
-- סימון שהחברה נבדקה, גם כשלא נמצא אף אחד, כדי שהסקריפט לא יחפש אותה שוב ושוב.
create table if not exists gold_recruiter_checks (
  company_id uuid primary key references companies(id) on delete cascade,
  checked_at timestamptz not null default now(),
  found int not null default 0
);
alter table gold_recruiters enable row level security;
alter table gold_recruiter_checks enable row level security;
drop policy if exists owner_only on gold_recruiters;
create policy owner_only on gold_recruiters for all
  using (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com')
  with check (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com');
drop policy if exists owner_only on gold_recruiter_checks;
create policy owner_only on gold_recruiter_checks for all
  using (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com')
  with check (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com');
notify pgrst, 'reload schema';
