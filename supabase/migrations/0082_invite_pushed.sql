-- 25.11.2026. פוש על כל אישור חברות. העמודה מסמנת שהפוש כבר יצא, כדי
-- שאותו אישור לא יתריע פעמיים. מי שאישר עד עכשיו מסומן כמי שהודיעו עליו,
-- אחרת הריצה הראשונה הייתה שולחת פוש על כל מי שאישר אי פעם.
alter table contacts add column if not exists invite_pushed_at timestamptz;
update contacts set invite_pushed_at = now()
  where invite_accepted_at is not null and invite_pushed_at is null;
notify pgrst, 'reload schema';
