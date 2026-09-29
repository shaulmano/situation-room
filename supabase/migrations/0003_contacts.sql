-- חדר המצב · contacts
--
-- Until now this database held no people on purpose: sync/jobs_sync.py drops
-- recruiter names and urls, and src/lib/apply.ts builds every recruiter link
-- at render time. That rule was about third parties who never agreed to be
-- catalogued, and it still holds for them.
--
-- This table is the other case: Shaul's own first-degree connections, exported
-- by him from his own LinkedIn account, so that a job at a company can show who
-- he already knows there instead of sending him to Easy Apply for the hundredth
-- time. Nothing here is scraped, and the owner-only policy is the same one
-- every other table carries.
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  -- Written by the importer, never computed by Postgres. The job screens build
  -- the same key in TypeScript (src/lib/contacts.ts) and the two have to agree
  -- character for character, which a generated column and a JS regexp cannot
  -- promise each other once Hebrew company names are in play.
  company_key text,
  title text,
  linkedin_url text,
  email text,
  -- Not in the export. Filled by hand from the job screen and never overwritten
  -- by a later import.
  phone text,
  note text,
  connected_on date,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A connection is identified by its profile url. The export leaves that empty
  -- for people who hid it, and those fall back to name plus company.
  dedupe_key text generated always as (
    case
      when linkedin_url is not null and linkedin_url <> '' then lower(linkedin_url)
      else lower(full_name) || '|' || lower(coalesce(company, ''))
    end
  ) stored
);

create unique index if not exists contacts_dedupe_key on contacts(dedupe_key);
create index if not exists contacts_company_idx on contacts(company_key);

alter table contacts enable row level security;
drop policy if exists owner_only on contacts;
create policy owner_only on contacts
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com');
