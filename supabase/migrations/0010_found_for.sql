-- איזה חיפוש מצא את המשרה.
--
-- 10.11.2026. שאול ביקש להבדיל בין חמשת התפקידים שהוא באמת מחפש לבין כל
-- השאר שהמערכת גוררת. המידע הזה היה קיים בזמן הסריקה, בלולאה שקוראת לסורק
-- פעם לכל תפקיד, ונזרק לפני הכתיבה. בלעדיו אי אפשר לענות "מאיזה תפקיד
-- המשרה הזאת הגיעה".
alter table jobs add column if not exists found_for text;

create index if not exists jobs_found_for_idx on jobs(found_for)
  where found_for is not null;

notify pgrst, 'reload schema';
