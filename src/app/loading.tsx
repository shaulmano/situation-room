// שלד לחדר המצב, מאותה סיבה כמו ב-/warm: שאול עובר בין שני המסכים האלה
// כל הזמן, ולחיצה שלא עושה כלום למשך שתי שניות נראית כמו לחיצה שלא נקלטה.
export default function Loading() {
  return (
    <main>
      <h2>חדר המצב</h2>
      <p className="screen-note">טוען…</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 7, padding: 12, height: 64,
            }}
          />
        ))}
      </div>
    </main>
  );
}
