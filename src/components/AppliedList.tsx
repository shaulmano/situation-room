'use client';
import { useState } from 'react';
import JobContacts from '@/components/JobContacts';
import type { WarmContact } from '@/lib/contacts';

// הגשות שאפשר להרים דרך מכר.
//
// 14.11.2026. נמדד: מתוך 550 ההגשות של שאול, 326 הן בחברות שהוא מכיר בהן
// מישהו, ו-358 אנשים שם לא קיבלו ממנו כלום. הדרך אליהם הייתה קיימת אבל
// פזורה על פני מסך ההגשות, 25 שורות בכל פעם, ולכן היא לא נוצלה.
//
// שאול הגביל את ההיקף: "תתחיל מהשבוע האחרון ואם זה מסובך מעכשיו". שבוע
// ולא חודש ולא הכל: הגשה מלפני חודשיים היא כבר לא משהו שמרימים, ורשימה
// של 326 שורות היא לא רשימת עבודה אלא עוד ערימה.

export type AppliedRow = {
  key: string;
  company: string;
  title: string;
  /** משרות נוספות באותה חברה שהגשת אליהן השבוע. */
  alsoTitles: string[];
  cvId: string | null;
  url: string | null;
  foundFor: string | null;
  /** כמה ימים עברו מההגשה. */
  days: number;
  /** כמה אנשים בשורה הזאת עוד מחכים לפנייה. אפס פירושו שטיפלת בה. */
  openCount: number;
  people: WarmContact[];
};

const BATCH = 10;

export default function AppliedList({ rows }: { rows: AppliedRow[] }) {
  const [shown, setShown] = useState(BATCH);
  const [q, setQ] = useState('');

  const needle = q.trim().toLowerCase();
  const found = rows.filter((r) => !needle
    || `${r.company} ${r.title} ${r.people.map((p) => p.full_name).join(' ')}`
         .toLowerCase().includes(needle));
  const list = found.slice(0, shown);

  if (rows.length === 0) {
    return (
      <div className="empty">
        <strong>אין הגשות מהשבוע האחרון עם מכר בפנים</strong>
        <span>
          ברגע שתגיש למשרה בחברה שאתה מכיר בה מישהו, היא תופיע כאן למחרת
          הבוקר, ובאותו יום היא כבר נמצאת בטאב "היום".
        </span>
      </div>
    );
  }

  const quiet: React.CSSProperties = {
    width: 'auto', flex: 'none', padding: '.45em .9em', fontSize: '.78rem',
    borderRadius: 6, fontWeight: 700, background: 'var(--raised)',
    color: 'var(--muted)', border: '1px solid var(--hair)',
  };

  return (
    <div>
      {rows.length > BATCH && (
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setShown(BATCH); }}
          placeholder="חפש חברה, משרה או שם"
          style={{
            width: '100%', marginBottom: 10, padding: '.5em .7em',
            fontSize: '.85rem', borderRadius: 6, border: '1px solid var(--hair)',
            background: 'var(--raised)', color: 'inherit',
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((r) => (
          <div
            key={r.key}
            style={{
              background: 'var(--raised)',
              border: '1px solid var(--hair)',
              borderRadius: 7, padding: 10,
              // שורה שטיפלת בה נשארת, דהויה, כעדות ליום העבודה.
              opacity: r.openCount === 0 ? 0.65 : 1,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '.86rem' }}>
              {r.company}
              {r.openCount === 0 && (
                <span className="chip ok" style={{ marginInlineStart: 6 }}>✓ טופל</span>
              )}
              <span className="chip mute" style={{ marginInlineStart: 6 }}>
                {r.days === 0 ? 'הגשת היום'
                  : r.days === 1 ? 'הגשת אתמול'
                  : `הגשת לפני ${r.days} ימים`}
              </span>
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{r.title}</div>
            {/* 14.11.2026: כרטיס אחד לחברה ולא אחד למשרה. מרטנס הופיעה
                פעמיים עם אותו איש קשר, כלומר שתי הודעות זהות לאותו אדם
                באותו יום. אותו לקח מהתור של המפרסמים. */}
            {r.alsoTitles.length > 0 && (
              <div style={{ color: 'var(--muted)', fontSize: '.74rem' }}>
                הגשת שם גם ל: {r.alsoTitles.join(' · ')}
              </div>
            )}
            <JobContacts
              contacts={r.people}
              job={{
                company: r.company, title: r.title, cvId: r.cvId,
                url: r.url, foundFor: r.foundFor, applied: true,
              }}
              open
            />
          </div>
        ))}
      </div>

      {list.length === 0 && (
        <p className="screen-note" style={{ margin: 0 }}>
          אין התאמה ל"{q}". נקה את החיפוש כדי לראות את כל הרשימה.
        </p>
      )}

      {shown < found.length && (
        <button
          type="button" style={{ ...quiet, marginTop: 10 }}
          onClick={() => setShown(shown + BATCH)}
        >
          עוד {Math.min(BATCH, found.length - shown)} מתוך {found.length - shown}
        </button>
      )}
    </div>
  );
}
