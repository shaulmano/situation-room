'use client';
import { useState } from 'react';
import { cvFileName, inviteMessage, isRecruiter } from '@/lib/outreach';

// "אישר חברות".
//
// 15.11.2026. שאול שלח צילום של מייל "Ron accepted your invitation" וביקש
// שמי שמאשר יקבל מכתב עם קורות חיים, אישי יותר, ועם התעניינות אם יש אצלו
// משרות פתוחות.
//
// **זה סוגר את הצעד האמצעי.** ב-13.11 נקבע שבקשת חברות היא חצי פנייה ושיש
// שלושה צעדים: בקשה, אישור, ואז ההודעה עם הקובץ. האישור היה הצעד היחיד
// שאיש לא ידע עליו, ושאול היה צריך לשים לב בעצמו שמישהו אישר. עכשיו המייל
// של לינקדאין מזהה אותו, והשורה מופיעה כאן מוכנה.
//
// **השליחה היא שלו ולא שלנו.** אין כאן שום אוטומציה של לינקדאין: המסך נותן
// את הנוסח, את שם הקובץ ואת הקישור לפרופיל, והוא שולח בעצמו ואז מסמן.

export type Invite = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  profile: string | null;
  /** לפני כמה ימים אישר. */
  days: number;
};

export default function InviteQueue({ rows }: { rows: Invite[] }) {
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const open = rows.filter((r) => !sent[r.id]);

  async function mark(r: Invite) {
    setSent((cur) => ({ ...cur, [r.id]: true }));
    const res = await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, contacted: true }),
    }).catch(() => null);
    // נכשל, השורה חוזרת. שורה שנעלמה מהמסך ולא נשמרה גרועה משורה שסירבה.
    if (!res || !res.ok) setSent((cur) => ({ ...cur, [r.id]: false }));
  }

  async function copy(r: Invite) {
    const text = inviteMessage({ contactName: r.name, title: r.title });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied((cur) => ({ ...cur, [r.id]: true }));
    setTimeout(() => setCopied((cur) => ({ ...cur, [r.id]: false })), 1800);
  }

  if (open.length === 0) {
    return (
      <div className="iq-empty">
        אין אף אחד שאישר ועוד לא קיבל מכתב. ברגע שמישהו יאשר בקשת חברות,
        המייל של לינקדאין יזהה את זה והוא יופיע כאן מחר בבוקר.
      </div>
    );
  }

  return (
    <div className="iq">
      {open.map((r) => {
        const text = inviteMessage({ contactName: r.name, title: r.title });
        return (
          <div className="iq-row" key={r.id}>
            <div className="iq-head">
              <b>{r.name}</b>
              <span className="chip mute">
                {r.days === 0 ? 'אישר היום'
                  : r.days === 1 ? 'אישר אתמול'
                  : `אישר לפני ${r.days} ימים`}
              </span>
              {isRecruiter(r.title) && <span className="chip mute">מגייס/ת</span>}
            </div>
            {(r.title || r.company) && (
              <div className="iq-sub">{[r.title, r.company].filter(Boolean).join(' · ')}</div>
            )}

            <pre className="iq-msg">{text}</pre>

            <div className="iq-file">
              צרף את הקובץ: <b>{cvFileName(null)}</b>
            </div>

            <div className="iq-actions">
              <button type="button" className="apply" onClick={() => copy(r)}>
                {copied[r.id] ? '✓ הועתק' : 'העתק הודעה'}
              </button>
              {r.profile && (
                <a className="iq-link" href={r.profile} target="_blank" rel="noreferrer">
                  פתח פרופיל
                </a>
              )}
              <button type="button" className="iq-link" onClick={() => mark(r)}>
                שנשלח
              </button>
            </div>
          </div>
        );
      })}

      <style>{`
        .iq { display: flex; flex-direction: column; gap: 8px; }
        .iq-empty { background: var(--raised); border: 1px solid var(--hair);
                    border-radius: 8px; padding: 14px; font-size: .84rem;
                    line-height: 1.6; color: var(--muted); }
        .iq-row { background: var(--surface); border: 1px solid var(--hair);
                  border-radius: 8px; padding: 10px; }
        .iq-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
                   font-size: .9rem; }
        .iq-sub { color: var(--muted); font-size: .76rem; margin-top: 2px; }
        .iq-msg { white-space: pre-wrap; font-family: inherit; font-size: .78rem;
                  line-height: 1.5; background: var(--raised); border: 1px solid var(--hair);
                  border-radius: 6px; padding: 9px 10px; margin: 8px 0 6px;
                  direction: ltr; text-align: left; }
        .iq-file { font-size: .74rem; color: var(--muted); margin-bottom: 8px; }
        .iq-actions { display: flex; flex-wrap: wrap; gap: 6px; }
        .iq-actions > * { font-size: .78rem; font-weight: 700; padding: .45em .9em;
                          border-radius: 6px; }
        .iq-link { background: var(--raised); color: var(--muted);
                   border: 1px solid var(--hair); }
        /* 390 פיקסלים: שלושה כפתורים לא נדחסים לשורה אחת. */
        @media (max-width: 420px) { .iq-actions > * { flex: 1 1 auto; text-align: center; } }
      `}</style>
    </div>
  );
}
