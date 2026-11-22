-- 22.11.2026. הריצה הראשונה של find_recruiters החזירה שלוש חברות שהתוצאה
-- שלהן לא אמינה: Daisy (השם נפוץ, שני המגייסים עובדים בחברות אחרות), ו-
-- Lenovo ו-Mastercard (חברות עולמיות, כנראה מגייסות בחו"ל). הן נמחקות
-- ונבדקות שוב עם החיפוש המחמיר, כדי לא להשאיר בקשת חברות לאדם לא נכון.
delete from gold_recruiters where company_id in
  (select id from companies where name in ('Daisy','Lenovo','Mastercard'));
delete from gold_recruiter_checks where company_id in
  (select id from companies where name in ('Daisy','Lenovo','Mastercard'));
notify pgrst, 'reload schema';
