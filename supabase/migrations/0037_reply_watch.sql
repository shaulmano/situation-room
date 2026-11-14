-- ניטור תגובות בלינקדאין.
--
-- 14.11.2026. שאול גילה שלי צמח ענתה לו ב-12 באוקטובר ושאלה שאלה פשוטה,
-- והוא ראה את זה רק היום, 33 יום אחרי, בזמן ששלח לה הודעה נוספת. בלשונו:
-- "שלחתי למישהי שראיתי שהיא הגיבה לי מזמן... ופשוט לא הגבתי מלא זמן".
--
-- תגובה שלא נענתה היא ההפסד היקר ביותר במערכת: היא לא רק הזדמנות שאבדה,
-- היא גם נקראת אצל מי ששלח כמו חוסר עניין. 41 הודעות הביאו 3 תשובות,
-- כלומר כל אחת מהן שווה בערך ארבע עשרה פניות חדשות.
--
-- הסימן הנכון הוא לא "לא נקרא": את ההודעה של לי הוא פתח, והיא נשארה בלי
-- מענה. הסימן הוא **מי שלח אחרון בשיחה**. נמדד חי על 46 השיחות שלו:
-- הרשימה עצמה מציגה "You: ..." או "<שם>: ...", ולכן אפשר לזהות את זה בלי
-- לפתוח אף שיחה.

alter table contacts add column if not exists reply_text text;
alter table contacts add column if not exists reply_url  text;
-- מתי שאול סימן שטיפל. replied_at לבדו לא מספיק: הוא אומר שענו, לא
-- שסגרת את זה.
alter table contacts add column if not exists reply_done_at timestamptz;

-- על איזו משרה כתבת לו.
--
-- שאול, 14.11: "זה צריך להיות סוכן שרץ כמה פעמים ביום על מנת לקרוא ולהביא
-- אותו למשרה הנכונה שנשלחה."
--
-- עד עכשיו הסימון "נשלח" רשם רק שפנית, ולא על מה. בלי זה ההתראה יכולה
-- לומר "דנה ענתה לך" ולא "דנה ענתה לך על Project Manager ב-Elbit", ואז
-- אתה חוזר לחפש בעצמך בדיוק את מה שהסוכן אמור לחסוך.
alter table contacts add column if not exists last_job_id text;

-- מתי יצא פוש על התגובה הזאת. בלי זה כל ריצה של הסוכן הייתה מצלצלת שוב
-- על אותה תגובה, וזאת הדרך הבטוחה לגרום לשאול לכבות התראות.
alter table contacts add column if not exists reply_pushed_at timestamptz;

create index if not exists contacts_replied_open
  on contacts (replied_at desc)
  where replied_at is not null and reply_done_at is null;

notify pgrst, 'reload schema';
