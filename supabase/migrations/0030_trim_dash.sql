-- מקף תלוי בסוף שם החברה.
--
-- 13.11.2026. "מרטנס | Mertens – מקבוצת מלם תים" נחתך בקטעי עברית,
-- והקטע שנשאר הוא "Mertens –" עם מקף ארוך בסוף. ברשימת התווים לחיתוך
-- היה רק מקף רגיל. בקוד זה לא קורה כי שם מחלקים גם לפי המקף הארוך,
-- וזה היה רק בניקוי החד פעמי כאן.

update referrals
   set subject = btrim(subject, ' -–—|/,'),
       body = replace(body,
                      'I saw that you work at Mertens –.',
                      'I saw that you work at Mertens.')
 where status = 'pending'
   and (subject ~ '[-–—|/,]\s*$' or body like '%Mertens –%');
