-- שם החברה של כלל יצא בהודעה כ-"Clal Insurance & Finance- כלל ביטוח
-- ופיננסים", אנגלית ועברית באותה שורה. שאול, 12.11.2026: "תמחק את כלל
-- ביטוח ופיננסים".
--
-- החיתוך מכוון לדפוס אחד בלבד: שם לטיני, ואחריו מקף וזנב בעברית. חברה
-- ששמה עברי מלכתחילה, כמו מרטנס או שטראוס, לא נוגעים בה, ולכן התנאי
-- דורש אות לטינית לפני המקף.
update jobs
   set company = btrim(regexp_replace(company, '\s*-\s*[֐-׿].*$', ''))
 where company ~ '[A-Za-z]\s*-\s*[֐-׿]';

-- וההודעות שכבר בתור נכתבות מחדש עם השם המתוקן.
update referrals r
   set body = 'Hi ' || split_part(c.full_name, ' ', 1) || E',\n'
            || 'I saw that you work at ' || j.company || E'.\n'
            || 'I''m attaching my CV for the '
            || array_to_string(
                 (regexp_split_to_array(
                    btrim(regexp_replace(j.title, '\s*[,|(].*$', '')), '\s+'))[1:6],
                 ' ')
            || ' position, and I would be glad if you could pass it on '
            || E'internally to the relevant recruiters.\n\n'
            || E'Thanks a lot,\nShaul',
       subject = array_to_string(
                   (regexp_split_to_array(
                      btrim(regexp_replace(j.title, '\s*[,|(].*$', '')), '\s+'))[1:6],
                   ' ') || ' at ' || j.company
  from contacts c, jobs j
 where c.id = r.contact_id
   and j.id = r.job_id
   and r.status = 'pending';
