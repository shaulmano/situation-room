'use client';

// מסירת PDF למשתמש, בטלפון ובמחשב.
//
// הלוגיקה הזאת ישבה בתוך JobBrief וחזרה על עצמה ברגע שנוסף מסך שני עם
// קובץ. קישור רגיל לא עובד בטלפון: הקובץ נפתח בתוך אותו עמוד, בלי כפתור
// סגירה ובלי שמירה, וגם target="_blank" לא עזר. לכן מושכים את הקובץ
// ומוסרים אותו לתפריט השיתוף של המערכת, ששם יש "שמור בקבצים".
//
// רק במכשיר מגע. בווינדוס יש גם תפריט שיתוף, ולכן הוא היה נפתח במקום
// הורדה ושאול היה נתקע בלי קובץ.
export async function deliverPdf(url: string, name: string): Promise<string> {
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return 'ההורדה נכשלה';
  const blob = await res.blob();

  const nav = navigator as any;
  const touch = typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)')?.matches;
  try {
    const file = new File([blob], name, { type: 'application/pdf' });
    if (touch && nav.canShare && nav.canShare({ files: [file] })) {
      // רק files. כותרת או טקסט לצד הקובץ נשמרים ב-iOS כפריט נפרד.
      await nav.share({ files: [file] });
      return '';
    }
  } catch {
    // ביטול תפריט השיתוף הוא לא כישלון. נופלים להורדה.
  }

  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
  return '';
}
