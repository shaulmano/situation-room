-- 22.11.2026. הבדיקה על Lenovo הראתה שהמגייסים שנשמרו ל-Lenovo ו-Mastercard
-- לא נכונים (לא ישראלים, או שעזבו: "Past:" בכרטיס). נמחקים ונבדקים שוב
-- עם הסקריפט המתוקן, שפוסל תפקיד קודם ודורש Israel במיקום.
delete from gold_recruiters where company_id in
  (select id from companies where name in ('Lenovo','Mastercard'));
delete from gold_recruiter_checks where company_id in
  (select id from companies where name in ('Lenovo','Mastercard'));
notify pgrst, 'reload schema';
