'use client';
import { useState } from 'react';

// "יש לך תגובה", בראש מסך מכרים.
//
// 14.11.2026. שאול גילה שלי צמח ענתה לו ב-12 באוקטובר, 33 יום קודם, ושאלה
// שאלה פשוטה שנשארה בלי מענה. בלשונו: "שלחתי למישהי שראיתי שהיא הגיבה לי
// מזמן... ופשוט לא הגבתי מלא זמן".
//
// למה זה ראשון על המסך ולא עוד טאב: 41 הודעות הביאו 3 תשובות. תשובה אחת
// שווה בערך ארבע עשרה פניות חדשות, ולכן היא קודמת לכל פנייה שלא יצאה עדיין.
// ושתיקה מצדך נקראת אצל מי שענה כמו חוסר עניין, כלומר האיחור לא רק מעכב,
// הוא גם מזיק.

export type ReplyRow = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  /** מה הוא כתב. */
  text: string | null;
  /** קישור לשיחה עצמה בלינקדאין. */
  url: string | null;
  /** המשרה שכתבת לו עליה. */
  jobTitle: string | null;
  jobCompany: string | null;
  jobUrl: string | null;
  /** לפני כמה ימים הוא ענה. */
  days: number;
};

export default function ReplyBanner({ rows }: { rows: ReplyRow[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const open = rows.filter((r) => !done[r.id]);
  if (open.length === 0) return null;

  async function close(r: ReplyRow) {
    setDone((cur) => ({ ...cur, [r.id]: true }));
    const res = await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, replyDone: true }),
    }).catch(() => null);
    if (!res || !res.ok) setDone((cur) => ({ ...cur, [r.id]: false }));
  }

  const btn: React.CSSProperties = {
    width: 'auto', flex: 'none', padding: '.45em .9em',
    fontSize: '.78rem', borderRadius: 6, fontWeight: 700,
  };

  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--good) 12%, var(--surface))',
        border: '2px solid var(--good)',
        borderRadius: 8, padding: 12, marginBottom: 14,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 2 }}>
        יש לך {open.length === 1 ? 'תגובה' : `${open.length} תגובות`}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '.76rem', marginBottom: 10 }}>
        ענו לך ועוד לא חזרת אליהם. זה קודם לכל פנייה חדשה.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {open.map((r) => (
          <div
            key={r.id}
            style={{
              background: 'var(--raised)', border: '1px solid var(--hair)',
              borderRadius: 7, padding: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '.88rem' }}>
              {r.name}
              <span className="chip mute" style={{ marginInlineStart: 6 }}>
                {r.days === 0 ? 'ענה היום'
                  : r.days === 1 ? 'ענה אתמול'
                  : `ענה לפני ${r.days} ימים`}
              </span>
            </div>
            {(r.title || r.company) && (
              <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>
                {[r.title, r.company].filter(Boolean).join(' · ')}
              </div>
            )}

            {r.text && (
              <div
                style={{
                  margin: '8px 0', padding: '8px 10px',
                  background: 'var(--surface)', border: '1px solid var(--hair)',
                  borderRadius: 6, fontSize: '.82rem', whiteSpace: 'pre-wrap',
                }}
              >
                {r.text}
              </div>
            )}

            {/* המשרה שכתבת עליה. שאול, 14.11: "להביא אותו למשרה הנכונה
                שנשלחה". בלי השורה הזאת אתה יודע שמישהו ענה ולא על מה. */}
            {r.jobTitle ? (
              <div style={{ fontSize: '.78rem' }}>
                <b>כתבת לו על:</b>{' '}
                {r.jobUrl
                  ? <a href={r.jobUrl} target="_blank" rel="noreferrer">{r.jobTitle}</a>
                  : r.jobTitle}
                {r.jobCompany ? ` · ${r.jobCompany}` : ''}
              </div>
            ) : (
              <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>
                המשרה לא נרשמה בפנייה הזאת. זה נשמר רק מ-14.11 והלאה.
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {r.url && (
                <a
                  className="apply" style={{ ...btn, textAlign: 'center' }}
                  href={r.url} target="_blank" rel="noreferrer"
                >
                  פתח את השיחה
                </a>
              )}
              <button
                type="button"
                style={{
                  ...btn, background: 'var(--raised)', color: 'var(--muted)',
                  border: '1px solid var(--hair)',
                }}
                onClick={() => close(r)}
              >
                טיפלתי
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
