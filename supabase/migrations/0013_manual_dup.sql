-- משרה שהחיפוש הידני מצא, וכבר הייתה אצלנו מהסריקה הרגילה.
--
-- 10.11.2026, שאול: "בבוקר ביקשתי לסרוק ידנית ולתייג כידני. זה מעבר
-- לסריקות הרגילות ומעבר לכל מה שרץ. אם יש כפילות תסמן אותה ככפולה."
--
-- manual אומר שהחיפוש הידני מצא אותה. manual_dup אומר שהיא כבר הייתה כאן
-- לפניו. שני דברים שונים, ושניהם צריכים להיות גלויים: בלי השני אי אפשר
-- לדעת אם החיפוש הידני מביא ערך או רק חוזר על מה שכבר יש.
alter table jobs add column if not exists manual_dup boolean not null default false;

create index if not exists jobs_manual_dup_idx on jobs(manual_dup) where manual_dup;

notify pgrst, 'reload schema';
