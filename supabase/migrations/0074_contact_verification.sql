-- 22.11.2026. שאול: "אני רוצה וודאות לאנשי קשר". איש קשר נחשב מאומת רק אחרי
-- שהסקריפט במחשב פתח את הפרופיל שלו בלינקדאין וראה: חבר מדרגה ראשונה, עובד
-- עכשיו בחברה, ותפקיד גיוס. ייצוא אנשי הקשר הוא ממאי, ולכן תפקיד וחברה בו
-- עלולים להיות ישנים.
alter table contacts
  add column if not exists verified_at timestamptz,
  add column if not exists verified_ok boolean,
  add column if not exists verified_key text,
  add column if not exists verified_title text,
  add column if not exists verified_company text;
create index if not exists contacts_verified_idx on contacts (verified_key) where verified_ok;
notify pgrst, 'reload schema';
