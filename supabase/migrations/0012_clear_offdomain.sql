-- מוריד מהלוח משרות מענפים שאין להם קשר לשאול.
--
-- 10.11.2026. שער התחום פוסל אותן, אבל scan_sources.py כתב ישירות ל-jobs
-- בלי להחיל אותו, ולכן הן נכנסו היום. השער תוקן, וזה מנקה את מה שכבר נכנס.
--
-- dismissed_at ולא מחיקה: זאת בדיוק הפעולה שהכפתור X עושה, היא הפיכה,
-- והמשרה נשארת במסד לניתוח הסגירות.
update jobs
set dismissed_at = now()
where dismissed_at is null
  and (
    title ilike '%תחום החשמל%' or
    title ilike '%מיזוג אוויר%' or
    title ilike '%מיזוג-אוויר%' or
    title ilike '%מערכות חשמל%' or
    title ilike '%לוחות חשמל%' or
    title ilike '%חשמלאי%'
  );

notify pgrst, 'reload schema';
