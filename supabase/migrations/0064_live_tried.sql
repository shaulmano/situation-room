-- מתי נוסתה בדיקת אימות על משרה, גם כשלא הוכרעה. בלעדיו משרות שלינקדאין
-- מחזירה עליהן 429 היו תוקעות את התור, כי הן נשארות בלי live_checked_at.
alter table jobs add column if not exists live_tried_at timestamptz;
notify pgrst, 'reload schema';
