-- בדיקת ה-CRM ב-26.11.2026 רשמה הגשה, ראיון ודחייה על משרת LiveU (sc-9f871075c157d3). מוחק את שורת ההגשה ואת האירועים שלה.
delete from events where application_id = '98ed65b8-56fe-4162-8519-3086e40df2e8';
delete from applications where id = '98ed65b8-56fe-4162-8519-3086e40df2e8' and job_id = 'sc-9f871075c157d3';
