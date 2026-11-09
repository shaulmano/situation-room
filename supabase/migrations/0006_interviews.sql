-- שיחות וראיונות: איפה שאול רושם מה שקרה אחרי ההגשה.
--
-- 9.11.2026. שאול שאל איפה הוא מכניס שיחת טלפון או ראיון, והתשובה הייתה
-- שאין איפה. מסך ההגשות כבר יודע להציג 'conversation', 'interview'
-- ו-'offer', אבל שום דבר במערכת לא יכול לקבוע אותם: הסנכרון מג'ימייל מזיז
-- סטטוס רק ל-'acknowledged' ול-'silent'. לכן האריח "שיחות שהתקיימו" הראה
-- אפס מאז שנבנה, ולא בגלל שלא היו שיחות.
--
-- מגייס שמתקשר בטלפון לא משאיר שום עקבה בג'ימייל, ולכן זה חייב להיות ידני.

alter table applications
  -- מתי השיחה או הראיון הבא, כדי שאפשר יהיה להציג אותו לפני שהוא קורה ולא
  -- רק לספור אותו אחרי.
  add column if not exists next_at    timestamptz,
  -- 'call' או 'interview'. טקסט ולא enum: הסטטוסים כאן ממילא טקסט חופשי.
  add column if not exists next_kind  text,
  add column if not exists note       text,
  -- מי קבע את הסטטוס. 'auto' מהסנכרון, 'shaul' מהמסך. בלי זה סנכרון עתידי
  -- יכול לדרוס ביד קלה שיחה שנרשמה ידנית.
  add column if not exists status_by  text not null default 'auto';

-- המיון של "מה הקרוב ביותר" הוא השאילתה היחידה על העמודה הזאת.
create index if not exists apps_next_idx on applications(next_at)
  where next_at is not null;

-- כל שינוי סטטוס נרשם כאירוע, כדי שתהיה היסטוריה ולא רק מצב נוכחי.
-- events כבר קיימת ומשמשת את הסנכרון; classified_by מבדיל בין השניים.
create index if not exists events_app_idx on events(application_id);

notify pgrst, 'reload schema';
