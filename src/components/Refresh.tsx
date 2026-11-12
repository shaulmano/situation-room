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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
      <button
        type="button"
        disabled={pending}
        style={{
          width: 'auto', flex: 'none', padding: '.5em 1.1em',
          fontSize: '.82rem', borderRadius: 6, fontWeight: 700,
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
      {at && <span className="chip mute">עודכן {at}</span>}
    </div>
  );
}
