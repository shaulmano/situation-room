-- מגייסים ב-15 חברות מרשימת "ממתינות לבדיקת איש גיוס", לתור "בקשות חברות".
--
-- 24.11.2026. שאול שאל למה אי אפשר למצוא את המגייסים, וביקש שכל חברה תקבל
-- תוצאה. החיפוש רץ בדפדפן, והכותרות נקראו: נכנס רק מי שהכותרת או שורת
-- "Current" נוקבת בחברה. בחברות השמה (Experis, Dialog, Gtech, גב מערכות, Yael Group)
-- נכנסו ראשי צוותים ומגייסים טכנולוגיים, לא כל המגייסים.
--
-- **gold_recruiter_checks נכתב לכל חברה**, גם כשלא נמצא אף אחד, כדי שהתוצאה "נבדקה, אין"
-- תהיה כתובה ולא תיראה כמו "לא נבדקה". ב-Mastercard נמצאה Ilana B., אבל כבר
-- נשלחה לה בקשה (Pending), ולכן לא נכנסה.

insert into companies (registry_id, name, company_key, source, region)
select 'manual-' || v.k, v.n, v.k, 'manual', 'gush_dan'
from (values
  ('Experis', 'experis'),
  ('Dialog', 'dialog'),
  ('Bezeq International', 'bezeqinternational'),
  ('SHVA', 'shva'),
  ('Yael Group', 'yaelgroup'),
  ('Sharegain', 'sharegain'),
  ('Parallel Wireless', 'parallelwireless'),
  ('Sungrow Europe', 'sungroweurope'),
  ('Jifiti', 'jifiti'),
  ('Gtech', 'gtech'),
  ('גב מערכות', 'גבמערכות'),
  ('Coralogix', 'coralogix'),
  ('Daisy', 'daisy'),
  ('Weebit Nano', 'weebitnano'),
  ('ServiceNow', 'servicenow'),
  ('Akita', 'akita'),
  ('QualityAI', 'qualityai'),
  ('Utila', 'utila'),
  ('Sidelines Group', 'sidelinesgroup'),
  ('Mastercard', 'mastercard')
) as v(n, k)
where not exists (select 1 from companies c where c.company_key = v.k);

insert into gold_recruiters (company_id, full_name, headline, profile_url)
select (select id from companies where company_key = v.k order by first_seen_at limit 1),
       v.full_name, v.headline, v.url
from (values
  ('experis', 'Lida Yaes Naftali', 'Talent Acquisition Team Leader at Experis Israel', 'https://www.linkedin.com/in/lida-yaes/'),
  ('experis', 'Adi Shmueli', 'Recruitment Team Lead at Experis Israel', 'https://www.linkedin.com/in/adishmueli/'),
  ('experis', 'Noy Cohen', 'Technical Recruitment Team Leader at Experis', 'https://www.linkedin.com/in/noy-cohen-827429159/'),
  ('dialog', 'Yamit Cohen', 'Talent Acquisition Specialist at Dialog', 'https://www.linkedin.com/in/yamitcohen/'),
  ('dialog', 'Rinat Petilon', 'Technical Talent Acquisition Specialist at Dialog', 'https://www.linkedin.com/in/rinat-petilon-45b18214a/'),
  ('dialog', 'Yuval Shavit', 'Talent Acquisition Specialist at Dialog', 'https://www.linkedin.com/in/yuval-shavit-55b313229/'),
  ('bezeqinternational', 'Sarit Askayo', 'Senior Talent Acquisition Partner at Bezeq International', 'https://www.linkedin.com/in/sarit-askayo-30708b105/'),
  ('shva', 'Michal Shaybet (Saar)', 'HR Business Partner at SHVA - The payments arena', 'https://www.linkedin.com/in/michalshaybet/'),
  ('yaelgroup', 'Dorin David', 'Talent Acquisition Team Lead at Yael Group', 'https://www.linkedin.com/in/dorin-david-%E2%98%85i-m-hiring%E2%98%85-82979a61/'),
  ('yaelgroup', 'Liat Rozen', 'Technical Recruiter at Yael Group (R&D, QA, Data, Cyber, SAP, IT)', 'https://www.linkedin.com/in/liatrozen/'),
  ('yaelgroup', 'Lior Itzhaky', 'Talent Acquisition at Yael Group', 'https://www.linkedin.com/in/lior-itzhaky/'),
  ('sharegain', 'Arbel Liberman Noy', 'Senior Talent Acquisition Specialist at Sharegain', 'https://www.linkedin.com/in/arbel-liberman-noy-85855513/'),
  ('parallelwireless', 'Mor Mizrahi', 'Senior Talent Acquisition Partner at Parallel Wireless', 'https://www.linkedin.com/in/mor-mizrahi-21845444/'),
  ('parallelwireless', 'Kristina Trufanova', 'Talent Acquisition Partner at Parallel Wireless', 'https://www.linkedin.com/in/trufanova/'),
  ('sungroweurope', 'Olesya Tarasenko', 'Talent Acquisition Specialist at Sungrow Europe', 'https://www.linkedin.com/in/olesya-tarasenko/'),
  ('sungroweurope', 'Francesco Petrone', 'Talent Acquisition Specialist EMEA at Sungrow Europe', 'https://www.linkedin.com/in/francescopetrone2/'),
  ('jifiti', 'Tzivia Derovan', 'HR Business Partner and Global Talent Acquisition Lead at Jifiti', 'https://www.linkedin.com/in/tzivia-derovan-44956a172/'),
  ('gtech', 'Sapir Bar Sinai', 'Technical Recruiter at Gtech', 'https://www.linkedin.com/in/sapir-karni/'),
  ('gtech', 'Sally Kalboni', 'Talent Acquisition Specialist at Gtech', 'https://www.linkedin.com/in/sally-kalboni-b9850222b/'),
  ('gtech', 'Moria Malka', 'Technical Recruiter at Gtech', 'https://www.linkedin.com/in/moria-m/'),
  ('גבמערכות', 'Daniella Siles', 'Technical Talent Acquisition Specialist at GAV Systems Group', 'https://www.linkedin.com/in/daniella-siles-378a9a22a/'),
  ('גבמערכות', 'Dorin Hasson', 'Technical Recruiter at GAV Systems', 'https://www.linkedin.com/in/dorin-hasson-%E2%9C%B0-i-m-hiring-%E2%9C%B0-42081b1b4/'),
  ('גבמערכות', 'Noa Bar', 'Technical Recruiter at GAV Systems Group', 'https://www.linkedin.com/in/noa-bar-440b2822a/'),
  ('coralogix', 'Dana Shatil', 'Senior Global Talent Acquisition Partner at Coralogix', 'https://www.linkedin.com/in/dana-shatil-b06514155/')
) as v(k, full_name, headline, url)
on conflict (company_id, profile_url) do nothing;

insert into gold_recruiter_checks (company_id, found)
select (select id from companies where company_key = v.k order by first_seen_at limit 1), v.f
from (values
  ('experis', 3),
  ('dialog', 3),
  ('bezeqinternational', 1),
  ('shva', 1),
  ('yaelgroup', 3),
  ('sharegain', 1),
  ('parallelwireless', 2),
  ('sungroweurope', 2),
  ('jifiti', 1),
  ('gtech', 3),
  ('גבמערכות', 3),
  ('coralogix', 1),
  ('daisy', 0),
  ('weebitnano', 0),
  ('servicenow', 0),
  ('akita', 0),
  ('qualityai', 0),
  ('utila', 0),
  ('sidelinesgroup', 0),
  ('mastercard', 0)
) as v(k, f)
on conflict (company_id) do update set checked_at = now(), found = excluded.found;

notify pgrst, 'reload schema';
