-- 21.11.2026: "מוותר" על משרה בודדת בחברות זהב. עמודה נפרדת ולא dismissed_at,
-- כי ✕ במסכים הרגילים בכוונה לא מוריד משרה מזהב.
alter table jobs add column if not exists gold_skipped_at timestamptz;

-- שתי משרות Applied Materials סומנו הוגש פנימית בטעות (לחיצה על הכפתור
-- במקום מוותר). מחזירים אותן לרשימה.
delete from applications
 where channel = 'internal'
   and job_id in ('b9065dc121', '8509c963b0');

notify pgrst, 'reload schema';
