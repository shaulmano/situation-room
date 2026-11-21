-- חברות זהב: כינויי חברה. 21.11.2026. ההצלבה בין אנשי קשר ומשרות לחברות
-- נעשתה לפי שם מנורמל בלבד, ולכן "Scytale" ו"Scytale AI" לא נפגשו.
-- הטבלה רק **מוסיפה** התאמות: קודם ההתאמה המדויקת הקיימת, ואם אין, כינוי.
-- טבלה ריקה = ההתנהגות הקודמת בדיוק. לכיבוי: truncate company_aliases.
create table if not exists company_aliases (
  alias_key text primary key,
  company_key text not null,
  how text not null default 'tokens',
  created_at timestamptz not null default now()
);
create index if not exists company_aliases_company_idx on company_aliases(company_key);

alter table company_aliases enable row level security;
drop policy if exists owner_only on company_aliases;
create policy owner_only on company_aliases for all to authenticated
  using ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'shaul.mano@gmail.com');

notify pgrst, 'reload schema';
