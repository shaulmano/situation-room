'use client';

// מסך מכרים נפל, ומה שראית הוא המסך הלבן של Next עם Digest ומספר.
//
// ‏15.11.2026. שאול שלח צילום של "Application error: a server-side exception
// has occurred" ושאל "מה זה?". **המסך הזה לא אמר לו כלום**: לא מה נפל, לא
// מה עדיין עובד, ולא מה לעשות עכשיו. וזה המסך שהכי אסור שייעלם, כי בו
// יושבות התגובות שממתינות למענה.
//
// זאת אותה בחירה שכבר נעשתה כאן ב-`matchErr`: **להציג שגיאה ולא אפס.**
// מסך שנראה ריק נראה כמו "אין נתונים", ומסך לבן נראה כמו סוף העולם.
// שניהם משקרים.

export default function WarmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: '18px 16px', maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.1rem', marginBottom: 8 }}>
        מסך מכרים לא נטען
      </h1>
      <p style={{ fontSize: '.86rem', lineHeight: 1.6, color: 'var(--muted)' }}>
        משהו בשליפת הנתונים נפל. שום דבר לא נמחק ושום סימון לא אבד, זאת
        תקלת תצוגה בלבד. נסה לרענן, ואם זה חוזר תשלח לי את השורה שלמטה.
      </p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button type="button" className="apply" onClick={() => reset()}>
          נסה שוב
        </button>
        <a className="apply" href="/" style={{ textAlign: 'center' }}>
          חזרה לחדר המצב
        </a>
      </div>
      <pre
        style={{
          fontSize: '.72rem', whiteSpace: 'pre-wrap', direction: 'ltr',
          textAlign: 'left', background: 'var(--raised)',
          border: '1px solid var(--hair)', borderRadius: 6, padding: '8px 10px',
          color: 'var(--muted)',
        }}
      >
        {error?.digest ? `digest: ${error.digest}\n` : ''}
        {error?.message || 'no message'}
      </pre>
    </main>
  );
}
