-- תשע מגייסות ומגייסים ב-KPMG Israel, שהגיעו מחיפוש ששאול ביקש.
--
-- 17.11.2026. שאול הגיש ל-Project Manager AI Business Solutions ב-KPMG
-- Israel, הטאב "מגייסים" היה ריק, והוא שלח ארבעה קישורים ואז: **"תחפש
-- בלינקדאין תחת KPMG אז אנשים, אולי אני מפספס משהו."**
--
-- הוא פספס. בחיפוש יצאו **תשעה** ולא ארבעה.
--
-- **ולמה זה לא סותר את "קשרים מדרגה שנייה לא נגרדים מלינקדאין".** הכלל
-- נכתב נגד גרידה שיטתית של הרשת אל תוך המסד. כאן שאול ביקש במפורש לחפש
-- חברה אחת שהוא הגיש אליה, הסתכל על התוצאות, והקישורים הראשונים הם שלו.
-- זה אותו צד מותר כמו המפרסם ב-13.11, מי שאישר חברות ב-15.11, ואוריאל
-- קדש ב-16.11.
--
-- **הכותרות נקראו מהפרופילים עצמם ולא נוחשו.** לינקדאין חוסם שליפה
-- מהענן (robots_disallowed), ולכן הן נקראו בדפדפן של שאול, שמחובר.
--
-- **כולם דרגה שנייה.** אין לו שם אף קשר ישיר, ולכן המסלול הוא בקשת חברות
-- עם הערה ואז הודעה, או InMail. לא הודעה ישירה.
--
-- **ושם החברה נרשם "KPMG Israel" לכולם**, גם למי שבכותרת שלו כתוב רק
-- "KPMG". `companyKey` מצמצם ל-kpmgisrael מול kpmg, ואלה שני מפתחות
-- שונים: שורה שתירשם "KPMG" לא תופיע על המשרה הזאת בכלל. הכותרת
-- המקורית נשמרת מילה במילה ב-`note`, ולכן שום מידע לא אבד.
--
-- `contacted_at` ריק: הוא שולח ידנית, והסימון שלו.
insert into contacts (full_name, company, company_key, title, linkedin_url,
                      source, last_job_id, note)
select v.full_name, 'KPMG Israel', 'kpmgisrael', v.title, v.url,
       'manual', '0770cc4e99', v.note
from (values
  ('Yael Mass', 'Talent Acquisition Recruiter',
   'https://www.linkedin.com/in/yael-mass-%E2%98%85-i-m-hiring-%E2%98%85-0361ab41/',
   'חיפוש KPMG, 17.11.2026. "Talent acquisition recruiter at KPMG Israel", דרגה שנייה, 381 מכרים משותפים'),
  ('Roz Shitrit', 'Talent Acquisition Specialist',
   'https://www.linkedin.com/in/roz-shitrit-142081168/',
   'חיפוש KPMG, 17.11.2026. "Talent Acquisition Specialist at KPMG", דרגה שנייה, 267 מכרים משותפים'),
  ('Moran Zehavi', 'Talent Acquisition Specialist',
   'https://www.linkedin.com/in/moran-zehavi-9303b6b9/',
   'חיפוש KPMG, 17.11.2026. "Talent Acquisition Specialist at KPMG Israel", דרגה שנייה, 114 מכרים משותפים'),
  ('Ziv Azani Israeli', 'Talent Acquisition Specialist',
   'https://www.linkedin.com/in/ziv-azani-israeli-98a007190/',
   'חיפוש KPMG, 17.11.2026. "Talent Acquisition Specialist at KPMG", דרגה שנייה, 108 מכרים משותפים'),
  ('Dor Allouche Yosupov', 'Talent Acquisition & Employer Branding',
   'https://www.linkedin.com/in/dor-allush/',
   'חיפוש KPMG, 17.11.2026. "Talent Acquisition & Employer Branding - Interns at KPMG", מתמחים, דרגה שנייה, 97 מכרים'),
  ('Noy Hamama', 'Talent Acquisition Specialist',
   'https://www.linkedin.com/in/noy-hamama/',
   'חיפוש KPMG, 17.11.2026. "Talent Acquisition Specialist at KPMG Israel", דרגה שנייה, 63 מכרים משותפים'),
  ('Yuval Romano', 'Talent Acquisition Recruiter',
   'https://www.linkedin.com/in/yuval-romano-%E2%98%85-i-m-hiring-%E2%98%85-b39310192/',
   'חיפוש KPMG, 17.11.2026. "Talent Acquisition Recruiter at KPMG Israel", דרגה שנייה, 46 מכרים משותפים'),
  ('Roni Bar', 'Talent Acquisition Specialist',
   'https://www.linkedin.com/in/roni-bar1/',
   'חיפוש KPMG, 17.11.2026. "Talent Acquisition specialist at KPMG", דרגה שנייה, 22 מכרים משותפים'),
  ('Olga Andronov Shadmi', 'Talent Acquisition Specialist',
   'https://www.linkedin.com/in/olga-andronov-shadmi-%E2%98%85-i-m-hiring-%E2%98%85-477529197/',
   'חיפוש KPMG, 17.11.2026. "Talent Acquisition Specialist at KPMG Israel", דרגה שנייה, 7 מכרים משותפים')
) as v(full_name, title, url, note)
where not exists (
  select 1 from contacts c where c.linkedin_url = v.url
);

-- שתי התוצאות שלא נכנסו, בכוונה: Noa Bali ו-Meytav Zuzel Weiss יצאו
-- באותו חיפוש **בלי שם חברה בכותרת**, ולכן אין ראיה שהן ב-KPMG.
-- "אם לא בטוח תוריד אותו, אני רוצה רק דברים בטוחים".

notify pgrst, 'reload schema';
