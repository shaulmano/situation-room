-- בדיקת ה-CRM ב-26.11.2026: הגשה ושיחה וסגירה על NVIDIA, והגשה דרך מכר. מחזיר הכול.
delete from applications where id = 'fbdc9906-9541-4e56-b024-39d57e389f3a';
delete from applications where gmail_thread_id like 'manual:%' and company ilike 'nvidia%' and role ilike 'Director, Software Technical Program Management%' and sent_at > now() - interval '3 hours';
update contacts set contacted_at = null, last_job_id = null where id = '461bdb60-9129-4aef-bb80-2d52bc4e47c5';
