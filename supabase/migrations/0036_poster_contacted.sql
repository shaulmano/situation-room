-- "פניתי" הוא עובדה אחת על אדם אחד, לא שלוש עובדות בשלושה מסכים.
--
-- 14.11.2026. שאול פנה לטליה נובק נינו בטאב המפרסמים ב-13.11, ולמחרת היא
-- הוצגה שוב בטאב "השבוע" כאילו לא פנה: "פניתי אתמול ועדיין מופיעה כאילו
-- לא פניתי".
--
-- הסיבה: jobs.poster_sent_at מחזיק את הפנייה למפרסם, contacts.contacted_at
-- מחזיק את הפנייה למכר, ואף אחד מהם לא ידע על השני. מהיום /api/poster
-- מסמן את שניהם. זאת ההשלמה אחורה למי שכבר קיבל הודעה.
--
-- ההצלבה לפי ה-slug של הפרופיל, כי לינקדאין מחזירה il.linkedin.com בסריקה
-- ו-www.linkedin.com בייצוא אנשי הקשר. אותו אדם, שתי כתובות.

update contacts c
   set contacted_at = p.sent_at
  from (
        select lower(split_part(split_part(j.recruiter_url, '/in/', 2), '?', 1)) as slug,
               min(j.poster_sent_at) as sent_at
          from jobs j
         where j.poster_sent_at is not null
           and coalesce(j.recruiter_url, '') <> ''
         group by 1
       ) p
 where c.contacted_at is null
   and coalesce(c.linkedin_url, '') <> ''
   and p.slug <> ''
   and lower(split_part(split_part(c.linkedin_url, '/in/', 2), '?', 1)) = p.slug;
