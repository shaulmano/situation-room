-- קישור למודעה בהודעות שכבר בתור.
--
-- 13.11.2026. שלושת האנשים הראשונים שענו לפנייה בלינקדאין שאלו את אותה
-- שאלה בדיוק: על איזו משרה מדובר. אחד מהם, Amit Chai מ-DriveNets, כתב
-- במפורש "if you can attach the specific role you are interested in
-- that will help", וזה אחרי שההודעה כבר נקבה בשם התפקיד.
--
-- כלומר שם התפקיד לבדו לא מספיק: בחברה גדולה יש כמה משרות דומות, והם
-- צריכים לדעת על איזו מודעה להעביר את הקובץ.
--
-- הקישור בשורה נפרדת, כדי שאפשר יהיה ללחוץ עליו בלי לקרוא הכל.

update referrals r
   set body = regexp_replace(r.body, E'\n\nThanks a lot,',
                             E'\n\nThe role: ' || j.url || E'\n\nThanks a lot,')
  from jobs j
 where j.id = r.job_id
   and r.status = 'pending'
   and coalesce(j.url, '') <> ''
   and r.body not like '%The role:%';
