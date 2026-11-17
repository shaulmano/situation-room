-- חן רנדלר לוי, QPoint: שאול שלח לה את הנוסח שנכתב לה.
--
-- 17.11.2026, בלשונו: "שלחתי לראשונות כפי שכתבת". שני נוסחים נכתבו,
-- לעדן ברקו ולחן, ועדן כבר סומן על ידו ב-12:58.
--
-- **רק היא נכתבת כאן.** נטלי בואה, בר שרויטמן ומאיה בראון נשארות לא
-- מסומנות, כי סימון של מי שלא נשלח לו מוריד אותו מהתור לתמיד ובשקט.
update contacts
   set contacted_at = now(),
       last_job_id  = coalesce(last_job_id, 'aa3ddf4d25')
 where linkedin_url = 'https://www.linkedin.com/in/chenrendlelevi/'
   and contacted_at is null;
