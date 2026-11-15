-- פנייה רחבה: 25 ביום לאנשי קשר, בלי קשר למשרה פתוחה.
--
-- 15.11.2026. שאול: "אני באמת רוצה כל יום 20-30 אנשי קשר שאשלח להם
-- למשרת דליברי ופרוגרם", ובנוסף לשוטף ולא במקומו: "אני מפריד כי אני
-- מסודר. לא רוצה את זה בבליל של כל המשימות. כל טאב הוא יעודי למטרה
-- ספציפית."
--
-- **למה זה בכלל קיים.** מתוך 2,657 אנשי הקשר שלו פנה ל-41, אחוז וחצי.
-- לא כי לא טרח, אלא כי המערכת מציגה מכר **רק כשנפתחת משרה בחברה שלו**.
-- כל השאר ממתינים לאירוע שאולי לא יקרה.
--
-- **שתי עמודות ולא טבלה.** הפנייה היא על האדם ולא על משרה, ולכן אין פה
-- שורה לכל צמד. `wide_sent_at` הוא מה שמוריד אותו מהתור לתמיד,
-- ו-`wide_skipped_at` הוא ויתור מפורש שלו.
--
-- נפרד לגמרי מ-`contacted_at`, שמסמן פנייה על משרה קונקרטית בטאב
-- "בלינקדאין". שאול ביקש שהשניים לא יתערבבו, ולכן גם הסימון נפרד.
alter table contacts add column if not exists wide_sent_at timestamptz;
alter table contacts add column if not exists wide_skipped_at timestamptz;

-- התור נשלף לפי "עוד לא נשלח ולא ויתרתי", ולכן זה האינדקס שמשרת אותו.
create index if not exists contacts_wide_queue_idx
  on contacts (wide_sent_at, wide_skipped_at)
  where wide_sent_at is null and wide_skipped_at is null;

-- הספירה היומית, "כמה נשלחו היום", רצה על התאריך.
create index if not exists contacts_wide_sent_idx on contacts (wide_sent_at)
  where wide_sent_at is not null;

-- המלכודת שחזרה כאן כבר פעמיים: בלי זה PostgREST ממשיך להחזיר
-- "column does not exist", והמסכים מציגים אפס שורות בלי שגיאה.
notify pgrst, 'reload schema';
