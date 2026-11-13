-- בנייה מחדש של ההודעות שבתור, במקום טלאי על טלאי.
--
-- 13.11.2026, שאול: "אתה צוחק עלי? כזה מייל אתה רוצה שאשלח?" ושתי
-- תקלות בצילום, שתיהן שלי:
--
-- 1. המשפט המרכזי נמחק. מיגרציה 0027 החליפה את שם החברה עם הביטוי
--    'I saw that you work at .*\.', ונקודה בביטוי רגולרי תופסת כל תו.
--    החמדנות בלעה את כל ההודעה עד הנקודה האחרונה, כלומר גם את המשפט
--    שמבקש להעביר את קורות החיים. נשאר "ראיתי שאתה עובד שם" וקישור.
--
-- 2. הקישור היה כתובת עברית מקודדת, עשר שורות של %D7%9E%D7%A0.
--    בלינקדאין יש צורה קנונית קצרה עם המזהה המספרי, והיא נפתחת לאותה
--    מודעה בדיוק.
--
-- הלקח, והוא כבר רשום אצלנו מהפעם הקודמת: לא מתקנים טקסט בביטוי
-- רגולרי על טקסט קיים. בונים אותו מחדש מהשדות.

with t as (
  select r.id,
         split_part(c.full_name, ' ', 1) as first_name,
         coalesce(
           (select btrim(part, ' -|/,')
              from regexp_split_to_table(j.company, '[֐-׿]+') as part
             where btrim(part, ' -|/,') ~ '[A-Za-z]'
             order by length(btrim(part, ' -|/,')) desc
             limit 1),
           j.company) as company_en,
         case
           when j.title !~ '[֐-׿]' then
             array_to_string(
               (regexp_split_to_array(
                  btrim(regexp_replace(j.title, '\s*[,|(].*$', '')), '\s+'))[1:6], ' ')
           when coalesce(j.found_for, '') <> '' and j.found_for !~ '[֐-׿]'
             then j.found_for
           when j.title ~ 'ארגון\s*ו?שיטות' then 'Organization and Methods Project Manager'
           when j.title ~ 'אבטחת\s*איכות' then 'QA Manager'
           when j.title ~ 'ראש\s*צוות' then 'Team Lead'
           when j.title ~ 'מנהל[/.]?ת?\s*תוכני' then 'Program Manager'
           when j.title ~ 'מנהל[/.]?ת?\s*פרויקט' then 'Project Manager'
           when j.title ~ 'מנהל[/.]?ת?\s*איכות' then 'Quality Manager'
           when j.title ~ 'מנהל[/.]?ת?\s*שחרור' then 'Release Manager'
           else 'Project Manager'
         end as title_en,
         -- לינקדאין: המזהה המספרי לבדו. אחרת הכתובת כמו שהיא.
         case
           when j.url ~ 'linkedin\.com/jobs/view/' then
             'https://www.linkedin.com/jobs/view/'
             || (regexp_match(j.url, 'linkedin\.com/jobs/view/(?:.*?-)?(\d{6,})'))[1]
           else j.url
         end as link,
         (c.title ~* 'talent acquisition|recruit|sourcer|sourcing|human resources|hrbp|people partner|staffing'
          or c.title like '%גיוס%' or c.title like '%מגייס%' or c.title like '%משאבי אנוש%')
           as is_recruiter
    from referrals r
    join contacts c on c.id = r.contact_id
    join jobs j on j.id = r.job_id
   where r.status = 'pending'
)
update referrals r
   set subject = t.title_en || ' at ' || t.company_en,
       body = 'Hi ' || t.first_name || E',\n'
            || 'I saw that you work at ' || t.company_en || E'.\n'
            || 'I''m attaching my CV for the ' || t.title_en
            || ' position, and I would be glad if you could '
            || case when t.is_recruiter then 'take a look.'
                    else 'pass it on internally to the relevant recruiters.' end
            || case when coalesce(t.link, '') <> ''
                    then E'\n\nThe role: ' || t.link else '' end
            || E'\n\nThanks a lot,\nShaul'
  from t
 where t.id = r.id;
