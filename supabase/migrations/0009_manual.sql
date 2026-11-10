-- משרה שנמצאה בחיפוש הידני בלינקדאין.
--
-- 10.11.2026. שאול ביקש חיפוש שהוא מפעיל בעצמו, דרך לינקדאין, על חמשת
-- התפקידים שהוא מחפש דרך קבע, וביקש שכל משרה שתימצא בו תוצג כ"ידני".
--
-- דגל ולא מקור: המשרה באמת הגיעה מלינקדאין, והחלפת ה-source הייתה משקרת
-- למסך המקורות ולפילוח שמודד מי מהלוחות מרוויח את זמן הריצה שלו.
alter table jobs add column if not exists manual boolean not null default false;

create index if not exists jobs_manual_idx on jobs(manual) where manual;

notify pgrst, 'reload schema';
