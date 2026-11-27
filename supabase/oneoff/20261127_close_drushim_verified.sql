-- 27.11.2026: אומת בדפדפן אמיתי. ca9f1a5027 מחזירה 410, ושתי האחרות מציגות היום כותרת אחרת (המודעה הוחלפה).
update jobs set closed_at = now(), live_checked_at = now() where id in ('ca9f1a5027','f9c4f30f64','71f6cd3fa8') and closed_at is null;
