-- בדיקת תצוגת "לפי משרה" ב-27.11.2026 סימנה "הוגשה ישירות" על comblack AI Product Manager (sc-1c6bd5d5e42ff8). מוחק את שורת ההגשה ואת האירועים שלה.
delete from events where application_id = '8a8e8354-7a2e-4a6f-923e-8403a4ee1525';
delete from applications where id = '8a8e8354-7a2e-4a6f-923e-8403a4ee1525' and job_id = 'sc-1c6bd5d5e42ff8';
