-- הכנסה ידנית של איש קשר ששאול מצא בעצמו.
--
-- 16.11.2026. שאול הגיש ל-Technological Project Manager בלינובייט, המודעה
-- לא נשאה מפרסם, ולא היה לו שם אף מכר. הוא חיפש בלינקדאין בעצמו, מצא את
-- אוריאל קדש, People Partner בחברה, וביקש: "אתה יכול להכניס אותו בצורה
-- ידנית כדי שאשלח לו הודעה מסודרת?"
--
-- **ולמה זה לא סותר את "מגייסים צד שלישי לא נשמרים".** הכלל נכתב נגד גרידה
-- של אנשים מהרשת ונגד שמירת מגייסים של חברות השמה. כאן זה לא גרידה: שאול
-- מצא אותו בעצמו, הוא עובד של החברה שהוא הגיש אליה, והוא ביקש במפורש
-- לשמור אותו. אותו צד מותר של הכלל כמו המפרסם ב-13.11 ומי שאישר חברות
-- ב-15.11.
--
-- `contacted_at` נשאר ריק בכוונה. הוא שולח עכשיו ידנית, והסימון הוא שלו.
-- מה שלא ראיתי קורה לא נרשם כאילו קרה.
--
-- `company_key` נכתב ידנית ולא מחושב, כמו בכל שאר הייבוא: `companyKey`
-- ב-`src/lib/contacts.ts` מחזיר 'linnovate', והשניים חייבים להסכים אות
-- באות כדי שמסכי המשרות ימצאו אותו.
insert into contacts (full_name, company, company_key, title, linkedin_url,
                      source, last_job_id, note)
select 'Oriel Kadas', 'Linnovate', 'linnovate', 'People Partner',
       'https://www.linkedin.com/in/orielkadas/',
       'manual', '600b78631e',
       'נמצא ידנית על ידי שאול, 16.11.2026. המודעה לא נשאה מפרסם.'
where not exists (
  select 1 from contacts
  where linkedin_url ilike '%/in/orielkadas%'
);

notify pgrst, 'reload schema';
