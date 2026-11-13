-- התור של המפרסמים: מה נשלח, מי ענה, על מי ויתרת.
--
-- 13.11.2026. שאול: "ברגע ששלחתי ולחצתי על פורסם זה עובר לשם ישירות".
--
-- המצב יושב על המשרה ולא על איש קשר, וזאת ההחלטה המהותית כאן: הפנייה היא
-- למפרסם *של המודעה הזאת*, על המשרה הזאת. אותו אדם יכול לפרסם שלוש משרות
-- ושאול יפנה אליו על אחת מהן. וחוץ מזה רוב המפרסמים אינם אנשי הקשר שלו,
-- ולכן אין להם שורה ב-contacts שאפשר לתלות עליה סטטוס.

alter table jobs add column if not exists poster_sent_at    timestamptz;
alter table jobs add column if not exists poster_replied_at timestamptz;
alter table jobs add column if not exists poster_skipped_at timestamptz;

notify pgrst, 'reload schema';
