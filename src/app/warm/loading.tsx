// שלד שמופיע מיד בלחיצה על "מכרים".
//
// 14.11.2026, שאול: "המעבר צריך להיות מהיר כי כרגע הוא ממש איטי. ממש."
//
// חלק מהאיטיות הוא זמן השליפות, וחלק גדול ממנה הוא שעד שהן נגמרות לא
// קורה כלום על המסך: הלחיצה נראית כאילו לא נקלטה, והוא לוחץ שוב. הקובץ
// הזה מחליף את ההמתנה השקטה בכותרת ובטאבים שמופיעים מיד, ואז התוכן
// נכנס מתחתם.
export default function Loading() {
  const bar = (w: string, h = 14) => ({
    width: w, height: h, borderRadius: 6,
    background: 'var(--raised)', border: '1px solid var(--hair)',
  });

  return (
    <main>
      <h2>דרך מישהו שאתה מכיר</h2>
      <p className="screen-note">טוען את מה שמחכה לך…</p>

      <div className="filters" style={{ marginBottom: 10 }}>
        {['היום', 'השבוע', 'במייל', 'בלינקדאין', 'מפרסמים', 'משרות פתוחות']
          .map((label) => (
            <span key={label} className="filter" style={{ width: 'auto', flex: 'none', opacity: 0.5 }}>
              {label}
            </span>
          ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 7, padding: 12, display: 'flex',
              flexDirection: 'column', gap: 8, opacity: 0.6,
            }}
          >
            <div style={bar('45%', 16)} />
            <div style={bar('70%')} />
            <div style={bar('30%')} />
          </div>
        ))}
      </div>
    </main>
  );
}
