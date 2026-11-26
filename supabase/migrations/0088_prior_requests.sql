-- 26.11.2026. גל מאי: מי ששאול שלח לו בקשת חברות או הודעה לפני חודשים ולא אישר.
-- הם לא ב-contacts כי הם מעולם לא אישרו, ולא ב-gold_recruiters כי הם לא נאספו משם.
-- ברשימת הלקוחות הם מופיעים כ"לא חבר" עם הערה, כדי שאף אחד מהם לא יוצע כפנייה ראשונה.
-- slug הוא זהות הפרופיל (אחרי /in/, מפוענח). אין כאן כתובת מלאה ואין מייל.
create table if not exists prior_requests (
  slug text primary key,
  full_name text not null,
  title text,
  company text,
  sent_on date not null default '2026-05-31',
  source text not null default 'may-wave',
  created_at timestamptz not null default now()
);
alter table prior_requests enable row level security;
drop policy if exists owner_only on prior_requests;
create policy owner_only on prior_requests for all
  using (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com')
  with check (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com');
notify pgrst, 'reload schema';
