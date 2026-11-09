-- מה הגשה הגיעה אליו, בנפרד ממה הסטטוס שלה עכשיו.
--
-- 9.11.2026. שאול סימן שתי הגשות, שתיהן כ"נדחה", ואמר שהיו לו שתי שיחות
-- טלפון ושני ראיונות החודש ושזה לא מוצג. שתי סיבות:
--
-- 1. הכפתור דרש שתי הקשות, והרישום קרה רק בהקשה על "שמור".
-- 2. 'rejected' דרס את מה שהיה לפניו. ראיון שלא עבר הוא עדיין ראיון
--    שהתקיים, והאריח "שיחות שהתקיימו" סופר סטטוס נוכחי בלבד. לכן הוא
--    נשאר אפס גם אחרי שסימן.
--
-- stage הוא השלב הרחוק ביותר שההגשה הגיעה אליו, והוא לא נמחק לעולם.
-- status נשאר מה שקורה עכשיו. דחייה אחרי ראיון משאירה stage='interview'
-- ו-status='rejected', ושניהם נכונים.

alter table applications
  -- 'call' | 'interview' | 'offer'
  add column if not exists stage     text,
  add column if not exists stage_at  timestamptz;

create index if not exists apps_stage_idx on applications(stage)
  where stage is not null;

notify pgrst, 'reload schema';
