'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// כפתור רענון מפורש.
//
// 12.11.2026, שאול: "תעשה למען השם כפתור רענון בעמוד הזה". המסך הזה
// משתנה מתחתיו: קורות חיים נוצרים ברקע, ופנייה עוברת מ"מחכה לקורות
// החיים" ל"מוכנה לשליחה" בלי שום סימן. בלי כפתור הדרך היחידה היא
// למשוך את העמוד מלמעלה, ובאייפון זה לא תמיד תופס.
//
// router.refresh ולא reload: הוא מביא את הנתונים מהשרת ומשאיר את מצב
// המסך, כלומר סימונים ומיקום הגלילה לא נזרקים.
export default function Refresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [at, setAt] = useState<string>('');

  return (
    // 15.11.2026, שאול: "אני רוצה את הכפתור אותו גודל בגובה ובצבע אחר".
    // הוא ישב ליד "חזרה לחדר המצב" בגובה נמוך יותר ובאותו חום, ולכן נראה
    // כמו גרסה מוקטנת של אותו כפתור במקום כמו פעולה אחרת.
    //
    // אותו `padding` ואותו `font-size` כמו הקישור שלידו, וזה מה שמשווה
    // את הגבהים בלי מספר קבוע שיישבר בפעם הבאה שהטיפוגרפיה תזוז.
    //
    // הצבע הוא משטח עם מסגרת ולא ירוק או אדום: שני אלה קיבלו היום
    // משמעות על המסך הזה, "מחכה לפנייה" ו"נעשה", וכפתור רענון אינו אף
    // אחד משניהם.
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
      <button
        type="button"
        disabled={pending}
        style={{
          width: 'auto', flex: 'none', padding: '.7em 1.1em',
          fontSize: '.9rem', borderRadius: 6, fontWeight: 800,
          // בלי מסגרת, אחרת שני הפיקסלים שלה מגביהים את הכפתור ביחס
          // לקישור שלידו, ושאול ביקש בדיוק אותו גובה. נמדד: 38 מול 37.
          background: 'var(--ink)', color: 'var(--surface)',
          border: 0, cursor: 'pointer',
        }}
        onClick={() => start(() => {
          router.refresh();
          setAt(new Date().toLocaleTimeString('he-IL', {
            hour: '2-digit', minute: '2-digit',
          }));
        })}
      >
        {pending ? 'מרענן…' : 'רענן'}
      </button>
      {at && (
        <span className="chip mute" style={{ alignSelf: 'center' }}>
          עודכן {at}
        </span>
      )}
    </div>
  );
}
