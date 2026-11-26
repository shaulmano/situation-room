-- 26.11.2026. job_connect_asks.job_id נוצר כ-uuid, אבל jobs.id הוא טקסט,
-- ולכן כל כתיבה (ביקשתי או מוותר) נפלה ב-invalid input syntax והמסך
-- הציג "לא נשמר". הטבלה הייתה ריקה בשעת התיקון.
alter table job_connect_asks alter column job_id type text using job_id::text;
notify pgrst, 'reload schema';
