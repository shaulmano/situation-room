-- ארבעה אנשי גיוס ב-Nebius.
--
-- 23.11.2026. שאול שלח את המשרה "Senior Technical Program Manager - New Data
-- Center Launches" (gh_jid=4767377101) וביקש את איש הגיוס, ואחר כך ביקש
-- במפורש להוסיף אותם לחדר המצב. אותו מסלול כמו KPMG ו-QPOINT: החיפוש רץ
-- בדפדפן שלו, והכותרות נקראו ולא נוחשו.
--
-- **המשרה עצמה לא נוקבת בשם.** הדף מכיל רק טופס, ולכן אי אפשר לדעת מי מהם
-- אחראי עליה. הם נשמרים כאנשי הגיוס של החברה, ומקושרים למשרה.
--
-- **נכנסו:** Omri Grinfeld (דרגה ראשונה, Principal Talent Acquisition),
-- ושלושה בישראל, דרגה שנייה: Sofia Strakhov, Shani Friedman, Aviran Cohen.
--
-- **לא נכנסו:** Nikita Nikitin (אמסטרדם), Lior H. (הכותרת שלו לא מזכירה
-- את Nebius), ושתי אנשות משאבי אנוש (HRBP) שאינן גיוס.
insert into contacts (full_name, company, company_key, title, linkedin_url,
                      source, last_job_id, note)
select v.full_name, 'Nebius', 'nebius', v.title, v.url,
       'manual', (select id from jobs where url ilike '%4767377101%' limit 1), v.note
from (values
  ('Omri Grinfeld', 'Principal Talent Acquisition',
   'https://www.linkedin.com/in/omrigrinfeld/',
   'חיפוש Nebius, 23.11.2026. "Principal Talent Acquisition at Nebius", בריטניה, דרגה ראשונה'),
  ('Sofia Strakhov', 'Senior Global Talent Acquisition Partner',
   'https://www.linkedin.com/in/sofia-strakhov/',
   'חיפוש Nebius, 23.11.2026. "Senior Global Talent Acquisition Partner @ Nebius", תל אביב, דרגה שנייה, 16 מכרים משותפים'),
  ('Shani Friedman', 'Senior Global Talent Acquisition',
   'https://www.linkedin.com/in/shani-friedman-9834ab127/',
   'חיפוש Nebius, 23.11.2026. "Senior Global Talent Acquisition בחברה Nebius", ישראל, דרגה שנייה, 72 מכרים משותפים'),
  ('Aviran Cohen', 'Tech Recruiting',
   'https://www.linkedin.com/in/aviran-cohen/',
   'חיפוש Nebius, 23.11.2026. "Tech Recruiting @ Nebius | ex-Meta", תל אביב, דרגה שנייה, 247 מכרים משותפים')
) as v(full_name, title, url, note)
where not exists (
  select 1 from contacts c where c.linkedin_url = v.url
);

notify pgrst, 'reload schema';
