-- שם החברה באנגלית בהודעות שכבר בתור.
--
-- 13.11.2026. לוחות ישראליים מפרסמים שם דו לשוני, ובתוך הודעה באנגלית
-- זה נראה שבור: "I saw that you work at Clal Insurance & Finance- כלל
-- ביטוח ופיננסים".
--
-- מיגרציה 0020 ניקתה את זה בנתונים, והסריקה הבאה כתבה מעל וחזר השם
-- המקורי. לכן הניקוי עבר לקוד, בכל בנייה של הודעה, וכאן רק מיישרים
-- את השורות שכבר ממתינות.
--
-- הלוגיקה זהה: חותכים את השם בקטעי עברית, ולוקחים את הקטע הארוך ביותר
-- שיש בו אותיות לטיניות. חברה ששמה עברי בלבד נשארת כמו שהיא.

with en as (
  select r.id,
         coalesce(
           (select btrim(part, ' -|/,')
              from regexp_split_to_table(j.company, '[֐-׿]+') as part
             where btrim(part, ' -|/,') ~ '[A-Za-z]'
             order by length(btrim(part, ' -|/,')) desc
             limit 1),
           j.company) as company_en
    from referrals r
    join jobs j on j.id = r.job_id
   where r.status = 'pending'
)
update referrals r
   set subject = regexp_replace(r.subject, ' at .*$', ' at ' || en.company_en),
       body = regexp_replace(r.body, 'I saw that you work at .*\.',
                             'I saw that you work at ' || en.company_en || '.')
  from en
 where en.id = r.id;
