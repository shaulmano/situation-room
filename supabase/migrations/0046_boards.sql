-- לוחות הקריירה של החברות.
--
-- 15.11.2026. גוגל מגלה חברות, והלוח עצמו מגלה משרות. נמדד שהאינדקס
-- של גוגל ללוחות ATS ישן מאוד: 11 מתוך 12 מודעות שהוא החזיר היו כבר
-- סגורות. שורש לוח, לעומת זאת, לא יכול להיות ישן.
--
-- **הטבלה הזאת גדלה לבד**, וזה ההבדל מרשימת 27 לוחות ה-Greenhouse
-- שבבוט, שנכתבה ידנית ולא גדלה לעולם.
create table if not exists boards (
  id            bigserial primary key,
  company       text not null,
  url           text not null unique,
  source        text,
  discovered_at timestamptz not null default now(),
  last_read_at  timestamptz,
  last_ok       boolean,
  open_count    int,
  -- לוח שמת. לא נמחק, כדי שהגילוי לא יוסיף אותו שוב מחר.
  dead_since    timestamptz
);

create index if not exists boards_read_order_idx on boards (last_read_at nulls first)
  where dead_since is null;

notify pgrst, 'reload schema';
