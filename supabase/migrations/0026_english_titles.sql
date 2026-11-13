-- שכתוב ההודעות שכבר בתור, עם כותרת באנגלית.
--
-- 13.11.2026, שאול: "הכל צריך להיות באנגלית, אם אתה מזהה עברית פשוט
-- תתרגם לאנגלית". הפנייה לרייצ'ל בכלל המתינה לשליחה עם המשפט
-- "I'm attaching my CV for the מנהל.ת פרויקטים ארגון ושיטות position".
--
-- אותו סדר אמינות שבקוד: כותרת לטינית כמו שהיא, אחרת found_for שהוא
-- שם התפקיד באנגלית שבו המשרה נמצאה בחיפוש, אחרת טבלת ביטויים,
-- ולבסוף שם משפחת התפקידים.

with t as (
  select r.id,
         c.full_name,
         j.company,
         case
           when j.title !~ '[֐-׿]' then
             array_to_string(
               (regexp_split_to_array(
                  btrim(regexp_replace(j.title, '\s*[,|(].*$', '')), '\s+'))[1:6], ' ')
           when coalesce(j.found_for, '') <> ''
                and j.found_for !~ '[֐-׿]' then j.found_for
           when j.title ~ 'ארגון\s*ו?שיטות' then 'Organization and Methods Project Manager'
           when j.title ~ 'אבטחת\s*איכות' then 'QA Manager'
           when j.title ~ 'ראש\s*צוות' then 'Team Lead'
           when j.title ~ 'מנהל[/.]?ת?\s*תוכני' then 'Program Manager'
           when j.title ~ 'מנהל[/.]?ת?\s*פרויקט' then 'Project Manager'
           when j.title ~ 'מנהל[/.]?ת?\s*איכות' then 'Quality Manager'
           when j.title ~ 'מנהל[/.]?ת?\s*שחרור' then 'Release Manager'
           else coalesce(
             case r.cv_id
               when 'qa' then 'QA Manager'
               when 'program' then 'Project Manager'
               when 'delivery' then 'Delivery Manager'
               when 'release' then 'Release Manager'
               when 'project-release-manager' then 'Project and Release Manager'
             end, 'QA Manager')
         end as title_en,
         -- מגייס מקבל בקשה אחרת: הוא היעד ולא מתווך.
         (c.title ~* 'talent acquisition|recruit|sourcer|sourcing|human resources|hrbp|people partner|staffing'
          or c.title like '%גיוס%' or c.title like '%מגייס%' or c.title like '%משאבי אנוש%')
           as is_recruiter
    from referrals r
    join contacts c on c.id = r.contact_id
    join jobs j on j.id = r.job_id
   where r.status = 'pending'
)
update referrals r
   set subject = t.title_en || ' at ' || t.company,
       body = 'Hi ' || split_part(t.full_name, ' ', 1) || E',\n'
            || 'I saw that you work at ' || t.company || E'.\n'
            || 'I''m attaching my CV for the ' || t.title_en || ' position, and I would be glad if you could '
            || case when t.is_recruiter then 'take a look.'
                    else 'pass it on internally to the relevant recruiters.' end
            || E'\n\nThanks a lot,\nShaul'
  from t
 where t.id = r.id;
