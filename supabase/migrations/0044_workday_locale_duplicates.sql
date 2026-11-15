-- אותה משרה ב-Workday נכנסה פעמיים, בגלל מקטע השפה בכתובת.
--
-- ‏15.11.2026. שאול: **"אתה מציג לי משרות שכבר הגשתי אתמול"**, עם קישור
-- למשרה ב-Workday.
--
-- **מסך הרדאר כן מסנן משרות שהוגשו**, והשורה בכל זאת הופיעה. הסיבה היא
-- שהיו שתי שורות לאותה משרה בדיוק, אותו `JR-0094713`:
--
--     https://workday.wd5.myworkdayjobs.com/Workday/job/...        הוגשה
--     https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/...  לא
--
-- הזיהוי במערכת הוא לפי כתובת, ולכן מקטע השפה יצר משרה שנייה. הוא הגיש
-- וסימן על אחת, והתאומה נשארה על המסך כאילו לא נגע בה.
--
-- זה אותו דפוס המתועד כ"אין איחוד כפילויות בין מקורות", אבל כאן הוא קורה
-- **בתוך מקור אחד**, ולכן שום דבר לא מרמז עליו: אותו שם, אותה חברה, אותו
-- מזהה משרה, אותו לוח.
--
-- `canonical_url` ב-`sync/seo_jobs.py` מוריד את מקטע השפה לפני הכתיבה,
-- ולכן זה לא ייווצר שוב. כאן נסגרת התאומה שכבר נוצרה.
--
-- **סגירה ולא מחיקה.** ההגשה והניקוד תלויים בשורה, ומחיקה אינה הפיכה.

with norm as (
    select id,
           url,
           dismissed_at,
           regexp_replace(url, '^(https://[^/]+)/[a-z]{2}-[A-Z]{2}/', '\1/') as cu
      from jobs
     where url like '%.myworkdayjobs.com%'
)
update jobs j
   set dismissed_at = now()
  from norm a
 where j.id = a.id
   and j.dismissed_at is null
   -- a היא הגרסה עם מקטע השפה
   and a.url <> a.cu
   -- ויש לה תאומה בכתובת הקנונית
   and exists (select 1 from norm b where b.cu = a.cu and b.id <> a.id and b.url = b.cu);
