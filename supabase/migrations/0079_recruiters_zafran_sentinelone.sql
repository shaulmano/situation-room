-- מגייסים ב-Zafran Security וב-SentinelOne, לתור "בקשות חברות".
--
-- 24.11.2026. שאול ראה שבמסך חברות זהב 22 משרות מחכות לבדיקת איש גיוס ושאל
-- למה אי אפשר למצוא את המגייסים. החיפוש רץ בדפדפן, והכותרות נקראו: נכנס רק
-- מי שהכותרת או שורת "Current" נוקבת בחברה, ובישראל.
--
-- **Zafran:** Hila Ckerit (Talent Acquisition Manager). Meshi Betzer היא קשר
-- מדרגה ראשונה, ולכן לא נכנסה לתור הזה אלא ממתינה לבדיקת האימות.
-- **SentinelOne:** Carmel Yanay ו-Reut Lindner (Technical Recruiter).
-- ServiceNow, Daisy ו-Weebit Nano: החיפוש לא החזיר אף איש גיוס בישראל שהכותרת שלו נוקבת בחברה.
insert into companies (registry_id, name, company_key, source, region)
select 'manual-' || v.k, v.n, v.k, 'manual', 'gush_dan'
from (values ('Zafran Security', 'zafransecurity'), ('SentinelOne', 'sentinelone')) as v(n, k)
where not exists (select 1 from companies c where c.company_key = v.k);

insert into gold_recruiters (company_id, full_name, headline, profile_url)
select (select id from companies where company_key = v.k order by first_seen_at limit 1),
       v.full_name, v.headline, v.url
from (values
  ('zafransecurity', 'Hila Ckerit', 'Talent Acquisition Manager at Zafran Security',
   'https://www.linkedin.com/in/hila-ckerit-462909376/'),
  ('sentinelone', 'Carmel Yanay', 'Technical Recruiter at SentinelOne',
   'https://www.linkedin.com/in/carmelyanay/'),
  ('sentinelone', 'Reut Lindner', 'Senior Technical Recruiter at SentinelOne',
   'https://www.linkedin.com/in/reut-lindner-26aa6254/')
) as v(k, full_name, headline, url)
on conflict (company_id, profile_url) do nothing;

notify pgrst, 'reload schema';
