-- ניסוי של שאול ב-26.11.2026 סימן ראיון על ההגשה הזאת. מחזיר למצב שלפני: 'silent' בלי שלב.
update applications
   set status = 'silent', stage = null, stage_at = null, next_at = null, next_kind = null, status_by = null
 where id = '5b9d3c67-59b5-42a6-8f0c-5281ad885fd6' and status = 'interview';
delete from events
 where application_id = '5b9d3c67-59b5-42a6-8f0c-5281ad885fd6'
   and kind = 'status' and classified_by = 'shaul' and subject = 'interview'
   and received_at >= '2026-11-26T16:00:00Z';
