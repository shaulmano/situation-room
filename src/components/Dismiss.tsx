'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// רענון אחד לכל סדרת סגירות, לא אחד לכל לחיצה.
//
// 11.11.2026, שאול: "כל עדכון של פסילת משרה נורא איטי, לחיצה על X לוקחת
// המון זמן". השורה אמנם נעלמה מיד, אבל כל לחיצה קראה ל-router.refresh,
// שמריץ מחדש את כל השאילתות של המסך מול השרת, ובתוכנית Hobby גם מעיר
// פונקציה קרה. חמש סגירות ברצף היו חמישה רענונים מלאים, זה אחר זה,
// וכל אחד מהם משאיר את הכפתורים במצב ממתין.
//
// הטיימר משותף לכל השורות בעמוד בכוונה: סגירה שנייה מבטלת את הרענון של
// הראשונה, והמסך מתרענן פעם אחת כשהפסיקו ללחוץ.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export default function Dismiss({ id, ids }: { id: string; ids?: string[] }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);

  async function hide(e: React.MouseEvent<HTMLButtonElement>) {
    const row = (e.currentTarget as HTMLElement).closest('.row');
    setGone(true);
    if (row instanceof HTMLElement) {
      row.hidden = true;
      // גם בשורה, ולא רק בגיליון: הטלפון של שאול עשוי להחזיק גרסה ישנה
      // של ה-CSS במטמון, וסגנון על האלמנט עצמו לא תלוי בה.
      row.style.display = 'none';
    }

    const res = await fetch('/api/jobs/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ids: ids ?? [id] }),
    }).catch(() => null);

    // Put it back if the write never landed. A job hidden on screen but still
    // in the feed is worse than one that visibly refused to go.
    if (!res || !res.ok) {
      if (row instanceof HTMLElement) {
        row.hidden = false;
        row.style.display = '';
      }
      setGone(false);
      return;
    }

    // הכתיבה הצליחה והשורה כבר לא על המסך. הרענון נועד רק לעדכן את
    // המונים למעלה, ואין שום סיבה שהוא יחסום את הלחיצה הבאה.
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      router.refresh();
    }, 2500);
  }

  return (
    <button
      type="button" className="dismiss" onClick={hide}
      disabled={gone} title="הסתר — לא רלוונטית"
      aria-label="הסתר משרה"
    >
      ✕
    </button>
  );
}
