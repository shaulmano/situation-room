-- ‏12.11.2026. אינדקס שמשרת את המסנן שכל המסכים מתחילים בו.
--
-- כל מסך שואל את אותה שאלה: משרות שעל המטרה, שלא נפסלו, לפי תאריך.
-- בלי אינדקס זאת סריקה של טבלת המשרות בכל טעינת מסך, וטעינות המסך הן
-- חלק ממה שכילה את תקציב ה-Disk IO באותו יום.
--
-- אינדקס חלקי, כי 3,642 המשרות בטבלה הן בעיקר סגורות ונפסלות, ורק כ-771
-- מהן פתוחות. האינדקס הזה מכיל רק אותן.
create index if not exists jobs_board_idx
  on jobs(first_seen desc)
  where on_target and dismissed_at is null;

-- המסכים מצליבים כל משרה מול ההגשות כדי לדעת אם כבר הוגש אליה.
create index if not exists apps_job_idx on applications(job_id);

analyze jobs;
analyze matches;
analyze contacts;
