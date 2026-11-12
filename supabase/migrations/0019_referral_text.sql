-- נוסח הפנייה נכתב מחדש, בניסוח ששאול הכתיב מילה במילה ב-12.11.2026.
--
-- הנוסח הקודם פתח ב-"I have spent the last 15 years leading QA...". זה
-- פתיח של קורות חיים ולא של הודעה בין שני אנשים שמכירים, והוא מה שגרם
-- לפנייה להישמע קרה. שאול: "הניסוח של המייל ממש לא לטעמי".
--
-- ארבע השורות שכבר בתור נכתבו עם הנוסח הישן, ולכן הן מעודכנות כאן.
-- שורה שכבר נשלחה לא נוגעים בה: מה שיצא, יצא.
update referrals r
   set body = 'Hi ' || split_part(c.full_name, ' ', 1) || E',\n'
            || 'I saw that you work at ' || j.company || E'.\n'
            || 'I''m attaching my CV for the '
            -- אותו קיצור כותרת שבקוד: חותכים בפסיק, בסוגר או בקו אנכי,
            -- ולכל היותר שש מילים. לוחות מפרסמים כותרות באורך שורה שלמה,
            -- ושורה כזאת בתוך הודעה של ארבע שורות קוברת את הבקשה.
            || array_to_string(
                 (regexp_split_to_array(
                    btrim(regexp_replace(j.title, '\s*[,|(].*$', '')), '\s+'))[1:6],
                 ' ')
            || ' position, and I would be glad if you could pass it on '
            || E'internally to the relevant recruiters.\n\n'
            || E'Thanks a lot,\nShaul'
  from contacts c, jobs j
 where c.id = r.contact_id
   and j.id = r.job_id
   and r.status = 'pending';
