-- תור הפניות דרך מכרים.
--
-- 12.11.2026. מדידה: 540 הגשות קרות הביאו 22 פתיחות ושתי שיחות. 382
-- מהמשרות הפתוחות הן בחברה ששאול מכיר בה מישהו, והוא הגיש אליהן קר.
--
-- שאול ביקש לסמן אנשי קשר במסך אחד ושהשליחה תקרה מאחורי הקלעים, עם קובץ
-- קורות חיים מצורף ולא קישור. מתוך 447 אנשי הקשר שיושבים על משרות
-- פתוחות, לתשעה יש כתובת מייל ולכולם יש לינקדאין. לכן שני מסלולים:
--
--   email    שליחה אוטומטית מהג'ימייל שלו, עם הקובץ מצורף.
--   linkedin ההודעה מוכנה להעתקה, והשליחה ידנית. אוטומציה בלינקדאין
--            עוברת דרך החשבון שלו ומסכנת חסימה, וזה הנכס שאסור לאבד.
--
-- השם: קיימת כבר טבלה בשם outreach מהסכימה המקורית (0001), למעקב שיחות
-- עם חברות השמה: org, contact, role, called_at, outcome. אין אליה שום
-- קוד, אבל create table if not exists עליה לא עושה כלום בשקט, וזה בדיוק
-- מה שקרה בניסיון הראשון כאן. לא נוגעים בה.
--
-- מצבי הסטטוס, ובסדר הזה:
--   pending   שאול סימן. עוד לא נשלח כלום.
--   test_sent עותק בדיקה נשלח אליו עצמו. הוא קורא ומאשר.
--   approved  הוא אישר. הריצה הבאה שולחת לנמען האמיתי.
--   sent      נשלח.
--   failed    ניסיון שנכשל, עם הסיבה ב-note.
--   canceled  שאול ביטל.
--
-- שום שורה לא עוברת מ-test_sent ל-sent בלי אישור מפורש שלו. זה הכלל
-- שהוא חזר עליו יותר מכל כלל אחר: שליחה יוצאת רק אחרי שהוא אישר.

create table if not exists referrals (
  id          bigint generated always as identity primary key,
  contact_id  uuid not null references contacts(id) on delete cascade,
  job_id      text not null references jobs(id) on delete cascade,
  channel     text not null default 'email',
  cv_id       text,
  subject     text,
  body        text,
  status      text not null default 'pending',
  note        text,
  -- ה-PDF שנשלח בפועל, כדי שאפשר יהיה לדעת מה בדיוק קיבל כל אחד.
  pdf_base64  text,
  filename    text,
  created_at  timestamptz not null default now(),
  test_at     timestamptz,
  approved_at timestamptz,
  sent_at     timestamptz
);

-- אותו איש קשר לאותה משרה לא נכנס לתור פעמיים.
create unique index if not exists referrals_once
  on referrals(contact_id, job_id);

create index if not exists referrals_status_idx on referrals(status);

alter table referrals enable row level security;
drop policy if exists owner_only on referrals;
create policy owner_only on referrals
  for all
  using (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com')
  with check (auth.jwt() ->> 'email' = 'shaul.mano@gmail.com');

notify pgrst, 'reload schema';
