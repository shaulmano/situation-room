-- יעל מס ויובל רומנו: שאול שלח להן InMail.
--
-- 17.11.2026, בלשונו: "נשלח לשתיהן". שתיהן Talent Acquisition Recruiter
-- ב-KPMG Israel, והמשרה היא Project Manager AI Business Solutions.
--
-- **הסימון נכתב כאן ולא על ידו** כי הוא אמר שזה נשלח. מה שלא נאמר לא
-- נרשם: אוריאל קדש אישר חברות אבל אין עדות שההודעה עם הקובץ יצאה, ולכן
-- הוא לא נוגע כאן.
--
-- `last_job_id` נכתב יחד עם התאריך, וזאת כל הנקודה של 15.11: אפס מתוך
-- 64 אנשי קשר שסומנו נשאו משרה, ולכן כששאלו אותו "על איזו משרה כתבת"
-- לא הייתה תשובה.
update contacts
   set contacted_at = now(),
       last_job_id  = coalesce(last_job_id, '0770cc4e99')
 where linkedin_url in (
   'https://www.linkedin.com/in/yael-mass-%E2%98%85-i-m-hiring-%E2%98%85-0361ab41/',
   'https://www.linkedin.com/in/yuval-romano-%E2%98%85-i-m-hiring-%E2%98%85-b39310192/'
 )
   and contacted_at is null;
