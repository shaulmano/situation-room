-- 22.11.2026. Lenovo ו-Mastercard חזרו עם אותם אנשים גם אחרי שנוסף "Israel"
-- לחיפוש, כי המילה לא סיננה. עכשיו הסקריפט דורש Israel במיקום שעל הכרטיס.
delete from gold_recruiters where company_id in
  (select id from companies where name in ('Lenovo','Mastercard'));
delete from gold_recruiter_checks where company_id in
  (select id from companies where name in ('Lenovo','Mastercard'));
notify pgrst, 'reload schema';
