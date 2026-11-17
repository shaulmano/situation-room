-- עוד שלושה ב-QPoint, מדף החברה עצמו.
--
-- 17.11.2026. שאול שלח את `linkedin.com/company/qpoint-technologies/`
-- אחרי שהחיפוש כבר רץ, והדף הוסיף שלושה שהחיפוש לא החזיר.
--
-- **והחשוב מביניהם הוא עמית ולא מגייס.** Eden Berko הוא Project Manager
-- ב-QPoint, כלומר בדיוק התפקיד שהמשרה מחפשת. `pickContact` מדרג עמית
-- בתחום **לפני** מי שמחזיק את הגיוס, וזאת לא גחמה: עמית יודע אם התפקיד
-- באמת פתוח, ולהפניה פנימית ממנו יש משקל אחר.
--
-- הכותרות כפי שהן מופיעות בדף. כולם דרגה שנייה, כמו כל השאר שם.
--
-- **לא נכנסו:** Ofir Elbaz, שהכותרת שלו "Talent Acquisition Specialist"
-- בלי שם חברה ואין ראיה שהוא ב-QPoint; Aviv Fried, שהוא מגייס ב-sysnet
-- Group ולא כאן; ו-Irena Shraib מכספים.
insert into contacts (full_name, company, company_key, title, linkedin_url,
                      source, last_job_id, note)
select v.full_name, 'QPOINT Technologies', 'qpointtechnologies', v.title, v.url,
       'manual', 'aa3ddf4d25', v.note
from (values
  ('Eden Berko', 'Project Manager',
   'https://www.linkedin.com/in/eden-berko-3349801a4',
   'דף החברה, 17.11.2026. "Project Manager" ב-QPoint, עמית בתפקיד עצמו. דרגה שנייה, 97 מכרים משותפים'),
  ('Hila Kasdey', 'VP Outsourcing Solutions & HR',
   'https://www.linkedin.com/in/hila-kasdey-98677078',
   'דף החברה, 17.11.2026. "VP Outsourcing Solutions & HR", דרגה שנייה, 21 מכרים משותפים'),
  ('Maya Brown', 'Sourcing Specialist',
   'https://www.linkedin.com/in/maya-brown-7b6614153',
   'דף החברה, 17.11.2026. "Sourcing Specialist at QPoint Technologies", דרגה שנייה, 59 מכרים משותפים')
) as v(full_name, title, url, note)
where not exists (
  select 1 from contacts c where c.linkedin_url = v.url
);

notify pgrst, 'reload schema';
