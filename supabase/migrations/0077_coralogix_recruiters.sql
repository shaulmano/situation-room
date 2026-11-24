-- שתי מגייסות ב-Coralogix, לתור "בקשות חברות".
--
-- 24.11.2026. שאול שלח צילום של דף החברה בלינקדאין וביקש להוסיף את הצוות
-- הרלוונטי כדי שיישלח אליהם מכתב חברות. החיפוש רץ בדפדפן, והכותרות נקראו.
-- אין כרגע ב-Coralogix משרת QA, תוכניות או פרויקטים בישראל, ולכן לא נוספה משרה.
--
-- **נכנסו רק מי שהכותרת שלהן נוקבת ב-Coralogix ובישראל:** Bar Ostrich
-- (Senior Global Talent Acquisition Partner) ו-Hadar Kubeysi Boumendil
-- (Global Talent Acquisition Manager). לא נכנסו Joe Callina (ארה"ב, מכירות)
-- ושלושה שהכותרת שלהם לא מזכירה את החברה.
--
-- החברה לא הייתה במאגר, ולכן נוצרת שורה ידנית. אם היא כבר שם, לא נוגעים.
insert into companies (registry_id, name, company_key, source, region, website)
select 'manual-coralogix', 'Coralogix', 'coralogix', 'manual', 'gush_dan', 'https://coralogix.com'
where not exists (select 1 from companies where company_key = 'coralogix');

insert into gold_recruiters (company_id, full_name, headline, profile_url)
select (select id from companies where company_key = 'coralogix' order by first_seen_at limit 1),
       v.full_name, v.headline, v.url
from (values
  ('Bar Ostrich', 'Senior Global Talent Acquisition Partner @ Coralogix',
   'https://www.linkedin.com/in/bar-ostrich-916778157/'),
  ('Hadar Kubeysi Boumendil', 'Global Talent Acquisition Manager at Coralogix',
   'https://www.linkedin.com/in/hadar-kubeysi-boumendil-0566a54b/')
) as v(full_name, headline, url)
on conflict (company_id, profile_url) do nothing;

notify pgrst, 'reload schema';
