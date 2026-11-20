-- חברות זהב: מאגר היעדים. 20.11.2026, שאול: "הפוקוס עובר לקובץ".
-- נטען ומתעדכן יומית מ-sync/companies_sync.py. המאגר הציבורי הוא
-- matanarbel-startapp/techmap (רשם החברות, ODbL: חובה לציין מקור).
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  -- ח.פ, שם הקובץ במאגר. זה המפתח היציב, לא השם.
  registry_id text not null unique,
  name text not null,
  -- אותו מפתח של contacts.company_key (src/lib/contacts.ts), כדי שההצלבה תהיה ישירה
  company_key text not null,
  size_code text,          -- xs / s / m / l / xl, כפי שהמאגר נותן
  size_class text,         -- S עד 50, M 51-200, E מעל 200
  size_range text,         -- 1-10, 11-50, 51-200, 201-1,000, 1,001+
  category text,
  city text,
  region text,             -- gush_dan או other
  website text,
  careers_url text,
  is_hiring boolean not null default false,
  linkedin_id text,
  comeet_id text,
  lever_id text,
  source text not null default 'techmap',
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists companies_key_idx on companies(company_key);
create index if not exists companies_class_idx on companies(size_class, region);

alter table companies enable row level security;
drop policy if exists owner_only on companies;
create policy owner_only on companies for all to authenticated
  using ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com');

notify pgrst, 'reload schema';
