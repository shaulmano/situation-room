-- 26.11.2026. שאול: "יש המון שליחות ביום ואין לי את הקונטקסט אחרי יום".
-- מה ששאול שלח לאדם, כפי שהסוכן שקורא תגובות רואה אותו בשרשור. נכתב בנפרד
-- מהתגובה ולא נוגע בסימון ובפוש שלה.
alter table contacts add column if not exists last_sent_text text;
alter table contacts add column if not exists last_sent_at timestamptz;
-- נועה בר: הפנייה קדמה לעמודה, ולכן ממולאת מהשרשור שנקרא ב-26.11.
update contacts set
  last_sent_text = E'12:40 (25.11): בקשת חברות עם הערה כללית.\n16:09 (25.11), אחרי האישור: מכתב אישר חברות עם הרקע שלך ושאלה אם יש משהו פתוח, בלי משרה ובלי קישור. מצורף Shaul_Mano.pdf.',
  last_sent_at = '2026-11-25T14:09:00Z'
where email = 'noa.bar@gav.co.il' and last_sent_text is null;
notify pgrst, 'reload schema';
