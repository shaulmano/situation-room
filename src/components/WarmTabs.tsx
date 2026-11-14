'use client';
import { useState, type ReactNode } from 'react';

// הטאבים של מסך מכרים.
//
// 14.11.2026, שאול: "אני רוצה שהכל יהיה מסודר שלא יהיו לי שאלות איפה זה
// ומה אני עושה עם זה... אם צריך לעבור לטאב חדש שים טאב חדש. הכל צריך
// להיות פרפקט."
//
// עד עכשיו ישבו על המסך הזה חמישה בלוקים שונים זה מתחת לזה, וכל אחד
// מהם עונה על שאלה אחרת. זה היה נראה כמו מסך אחד ארוך בלי התחלה וסוף.
// כל טאב הוא עכשיו עבודה אחת, עם מספר שאומר כמה נשאר ומשפט שאומר מה
// עושים בו. בלי המשפט הזה הטאב הוא עוד מקום לשאול בו "ומה עכשיו".

export type WarmTab = {
  id: string;
  label: string;
  /** כמה פריטים ממתינים כאן. אפס מאפיר את הטאב אבל לא מסתיר אותו. */
  count: number;
  /** משפט אחד: מה עושים בטאב הזה. */
  note: string;
  panel: ReactNode;
};

export default function WarmTabs(
  { tabs, initial }: { tabs: WarmTab[]; initial?: string },
) {
  // 14.11.2026: הכפתור מחדר המצב מגיע עם ?tab=today, כי שאול רוצה לנחות
  // ישר על העבודה של היום ולא על הטאב שבמקרה יש בו הכי הרבה.
  // בלי זה: הטאב הראשון שיש בו עבודה, ואם אין בשום טאב, הראשון.
  const [active, setActive] = useState(() => {
    if (initial && tabs.some((t) => t.id === initial)) return initial;
    return (tabs.find((t) => t.count > 0) ?? tabs[0])?.id;
  });
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div>
      <div className="filters" style={{ marginBottom: 10 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'filter' + (t.id === active ? ' on' : '')}
            style={{
              width: 'auto', flex: 'none',
              opacity: t.count === 0 && t.id !== active ? 0.55 : 1,
            }}
            onClick={() => setActive(t.id)}
          >
            {t.label}
            <span className="n">{t.count}</span>
          </button>
        ))}
      </div>

      {/* המשפט הזה הוא החלק החשוב כאן, לא הטאב. */}
      <p className="screen-note" style={{ margin: '0 0 12px' }}>
        {current.note}
      </p>

      {current.panel}
    </div>
  );
}
