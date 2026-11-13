-- להחזיר את מה ששאול סימן כנשלח, כשזאת הייתה בקשת חברות.
--
-- 13.11.2026, מיד אחרי 0033. הוא סימן שלוש או ארבע שורות "נשלח" לפני
-- שההבחנה בין בקשה להודעה נבנתה, ואז ביקש: "אז סומנו משהו כמו 3-4
-- תחזיר אותם".
--
-- לא מחיקה: הבקשות באמת יצאו, והוא עשה את העבודה. העבודה שלא נעשתה היא
-- ההודעה עם הקובץ, שאפשר לשלוח רק אחרי שהצד השני אישר. לכן הסימון עובר
-- משדה ההודעה לשדה הבקשה, והשורה נוחתת ב"ממתין לאישור" במקום להיעלם.
--
-- רק מי ששאול לא מחובר אליו. מי שכן, "נשלח" באמת אמר הודעה עם קובץ.

update jobs j
   set poster_request_at = j.poster_sent_at,
       poster_sent_at    = null
 where j.poster_sent_at is not null
   and j.poster_request_at is null
   and coalesce(j.recruiter_url, '') <> ''
   and not exists (
         select 1 from contacts c
          where c.linkedin_url ilike
                '%/in/' || split_part(split_part(j.recruiter_url, '/in/', 2), '?', 1) || '%'
       );
