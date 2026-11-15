'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * רענון כשחוזרים לעמוד אחרי היעדרות ארוכה.
 *
 * הסיבה המקורית: סימון "הוגשה" בלשונית אחת השאיר את כל הלשוניות
 * האחרות מציגות את המשרה. העמודים נרנדרים בשרת, ולכן לשונית מחזיקה את
 * מה שהיה נכון כשהיא נטענה.
 *
 * **15.11.2026, שאול: "המסך עדיין עושה לי ריפרש כל דקה. למה זה עושה
 * את זה?"** זה לא היה טיימר אלא `focus` ו-`visibilitychange` בלי שום
 * סף: כל יציאה ללינקדאין וחזרה, כל התראה, כל כיבוי והדלקה של המסך
 * הפעילו רענון מלא. במסך מכרים הוא יוצא ללינקדאין על כל שורה, ולכן
 * שם זה קרה כל הזמן, ודווקא על המסך הכבד ביותר.
 *
 * מה שנשאר: רענון רק אחרי שהעמוד היה מוסתר **חמש דקות לפחות**. זה
 * עדיין פותר את הלשונית הישנה שנשכחה פתוחה, שזאת כל הסיבה שהרכיב
 * נכתב, ולא נוגע בחזרה מלינקדאין אחרי חצי דקה.
 *
 * ו-`focus` ירד לגמרי: הוא נורה גם כשסוגרים מקלדת או מתפריט, בלי שום
 * מעבר אמיתי, והוא לא מוסיף שום מקרה ש-`visibilitychange` לא מכסה.
 */
const AWAY_MS = 5 * 60 * 1000;

export default function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    // מתי העמוד הוסתר. null פירושו שהוא גלוי עכשיו.
    let hiddenAt: number | null =
      document.visibilityState === 'hidden' ? Date.now() : null;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= AWAY_MS) router.refresh();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [router]);

  return null;
}
