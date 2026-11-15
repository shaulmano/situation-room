'use client';
import { useState } from 'react';

/**
 * "נסגרה": המודעה כבר לא קיימת.
 *
 * 15.11.2026, שאול. כפתור נפרד מ-✕ בכוונה, כי הוא אומר דבר אחר. ✕ הוא
 * "לא רלוונטית אלי", וזה "הלוח הוריד אותה". שניהם מורידים את השורה.
 *
 * אין כאן `router.refresh`, מאותה סיבה שתועדה ב-Dismiss ב-11.11:
 * "לחיצה על X לוקחת המון זמן". השורה יורדת מיד, והמונים למעלה יתעדכנו
 * ברענון הבא ממילא.
 */
export default function MarkClosed({ id, ids }: { id: string; ids?: string[] }) {
  const [gone, setGone] = useState(false);

  async function close(e: React.MouseEvent<HTMLButtonElement>) {
    const row = (e.currentTarget as HTMLElement).closest('.row');
    setGone(true);
    if (row instanceof HTMLElement) {
      row.hidden = true;
      row.style.display = 'none';
    }

    const res = await fetch('/api/jobs/closed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ids: ids ?? [id] }),
    }).catch(() => null);

    // אותו כלל של Dismiss: שורה שנעלמה מהמסך והכתיבה לא נחתה היא גרועה
    // יותר משורה שסירבה לרדת, כי היא תחזור מחר בלי שום סימן.
    if (!res || !res.ok) {
      if (row instanceof HTMLElement) {
        row.hidden = false;
        row.style.display = '';
      }
      setGone(false);
    }
  }

  return (
    <button
      type="button" className="closed" onClick={close} disabled={gone}
      title="המודעה כבר לא קיימת. נסגרת גם בכל לוח אחר שהביא אותה"
    >
      נסגרה
    </button>
  );
}
