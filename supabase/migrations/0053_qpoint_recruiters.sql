-- ארבע אנשי גיוס ב-QPOINT Technologies.
--
-- 17.11.2026. שאול הצביע על "מנהל/ת פרויקטים טכנולוגיים, ארגון מוביל"
-- ושאל "אתה יכול למצוא שם איש קשר?". אותו מסלול כמו KPMG: הוא ביקש,
-- החיפוש רץ בדפדפן שלו, והכותרות נקראו ולא נוחשו.
--
-- **אין לו שם אף קשר מדרגה ראשונה.** חיפוש מסונן לדרגה ראשונה החזיר
-- חמישה שאף אחד מהם אינו ב-QPoint: המילה נתפסה בטקסט החופשי שלהם.
--
-- **שם החברה נרשם "QPOINT Technologies"** בדיוק כמו במשרה שהוא הסתכל
-- עליה, כדי ש-`companyKey` יתאים. שתי משרות אחרות שלהם רשומות
-- "Qpoint Technologies" מ-AllJobs, וזה מצטמצם לאותו מפתח.
--
-- **לא נכנסו: Yaacov Golpur (מנכ"ל), Eric Ritter (מכירות), Ronen Nagar
-- (CTO) ו-Idan Nadav (CIO).** הם לא גיוס, והפנייה הראשונה לחברה שהוא
-- עוד לא הגיש אליה אינה הולכת למנכ"ל.
insert into contacts (full_name, company, company_key, title, linkedin_url,
                      source, last_job_id, note)
select v.full_name, 'QPOINT Technologies', 'qpointtechnologies', v.title, v.url,
       'manual', 'aa3ddf4d25', v.note
from (values
  ('Chen Rendler Levi', 'Talent Acquisition Specialist, Technology',
   'https://www.linkedin.com/in/chenrendlelevi/',
   'חיפוש QPoint, 17.11.2026. "Talent Acquisition Specialist | Technology at QPoint Technologies", דרגה שנייה, 53 מכרים משותפים'),
  ('Natalie Buah', 'Technical Recruiter',
   'https://www.linkedin.com/in/natalie-buah-recruitmentspecialist/',
   'חיפוש QPoint, 17.11.2026. "Talent Acquisition Specialist @ QPoint Technologies | Technical Recruiter", דרגה שנייה, 50 מכרים משותפים'),
  ('Bar Shroytman', 'Talent Acquisition Specialist',
   'https://www.linkedin.com/in/bar-shroytman-30ba7a183/',
   'חיפוש QPoint, 17.11.2026. "Talent Acquisition Specialist at Qpoint Technologies", דרגה שנייה, 88 מכרים משותפים'),
  ('Dina Shir', 'HR & Operations Manager',
   'https://www.linkedin.com/in/dina-shir-7b4392132/',
   'חיפוש QPoint, 17.11.2026. "HR & Operation Manager @ QPoint Technologies", דרגה שנייה, 376 מכרים משותפים')
) as v(full_name, title, url, note)
where not exists (
  select 1 from contacts c where c.linkedin_url = v.url
);

notify pgrst, 'reload schema';
