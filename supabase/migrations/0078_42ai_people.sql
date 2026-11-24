-- שלושה אנשים שעובדים ב-42AI, לתור "בקשות חברות".
--
-- 24.11.2026. שאול ביקש להוסיף אנשים שעובדים שם כדי לבקש חברות. אין בחברה
-- מגייס ואין משרה פתוחה (היא יצאה מהסתר ב-2.11), ולכן אלה אנשי הצוות עצמו.
-- נכנסו רק מי שהכותרת שלהם נוקבת ב-42AI: Ehud Ezra (מייסד ו-CTO),
-- Shmuel Mizrachi (AI engineer) ו-Neta Dayagi (Behavioral Scientist).
-- החברה לא הייתה במאגר, ולכן נוצרת שורה ידנית.
insert into companies (registry_id, name, company_key, source, region)
select 'manual-42ai', '42AI', '42ai', 'manual', 'gush_dan'
where not exists (select 1 from companies where company_key = '42ai');

insert into gold_recruiters (company_id, full_name, headline, profile_url)
select (select id from companies where company_key = '42ai' order by first_seen_at limit 1),
       v.full_name, v.headline, v.url
from (values
  ('Ehud Ezra', 'Co-founder & CTO, 42AI',
   'https://www.linkedin.com/in/ehud-ezra-9b880171/'),
  ('Shmuel Mizrachi', 'AI engineer at 42AI',
   'https://www.linkedin.com/in/shmuel-mizrachi-b5136859/'),
  ('Neta Dayagi', 'Behavioral Scientist at 42AI & OMGene.ai',
   'https://www.linkedin.com/in/neta-dayagi-3798a81ba/')
) as v(full_name, headline, url)
on conflict (company_id, profile_url) do nothing;

notify pgrst, 'reload schema';
