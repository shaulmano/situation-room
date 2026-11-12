-- מחיקת כל משרות SecretJobs מהמסד.
--
-- שאול, 12.11.2026 בערב: "מחק". הוא ביקש ב-10.11 להוריד את המקור כי כל
-- המשרות שלו כפילויות, ומדידה אז תמכה בו: ל-158 מתוך 331 הייתה כותרת
-- זהה בדיוק למשרה ממקור אחר. ההורדה נעשתה בענן בלבד, והמחשב שלו המשיך
-- לסרוק ולכתוב שלוש פעמים ביום עד הערב.
--
-- ‏347 שורות. ל-14 מהן יש הגשה שיצאה בפועל: applications.job_id מוגדר
-- on delete set null, ולכן שורת ההגשה עצמה נשמרת ומאבדת רק את הקישור
-- למשרה. שאול אישר את זה במפורש אחרי שהוצג לו.
--
-- matches, cv_requests ו-referrals יורדים בקסקייד.

-- כדי שמסך ההגשות לא יציג שורה ריקה בלי שום הקשר, מעתיקים את שם המשרה
-- ואת החברה לתוך שורת ההגשה לפני שהמשרה נמחקת. שני השדות כבר קיימים שם.
update applications a
   set role = coalesce(a.role, j.title),
       company = coalesce(a.company, j.company)
  from jobs j
 where j.id = a.job_id
   and j.source ilike '%secret%';

delete from jobs where source ilike '%secret%';
