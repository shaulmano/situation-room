-- באיזו מערכת גיוס כל חברה מפרסמת, ככל שנמצא בבדיקה ציבורית.
--
-- 23.11.2026. שאול: "יש המון חברות שאתה לא מביא לי מידע מדף הקריירה שלהם.
-- דיברנו על אנטרפרייז ועל סטארטאפים. יש לך רשימה אבל אני לא רואה שמגיע
-- משם מידע." נמדד: ברשימה 5,453 חברות, לכולן אין מקור סריקה. הסורק קורא
-- רשימות קבועות בקוד (499 Comeet, 29 Greenhouse, 6 Lever) ולא את הרשימה.
create table if not exists company_ats (
  company_id uuid references companies(id) on delete cascade,
  platform text not null,
  token text not null,
  postings int not null default 0,
  il_postings int not null default 0,
  checked_at timestamptz not null default now(),
  primary key (company_id, platform, token)
);
alter table company_ats enable row level security;
notify pgrst, 'reload schema';
