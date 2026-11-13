'use client';
import { useMemo, useState } from 'react';
import { cvFileName, referralMessage } from '@/lib/outreach';
import { type Pick } from './WarmPicker';

// התור של לינקדאין.
//
// 13.11.2026. מדידה: 605 משרות פתוחות על המטרה שלא הוגש אליהן, 296
// מאנשי הקשר של שאול יושבים על אחת מהן, ול-291 מהם אין כתובת מייל.
// לכולם יש פרופיל. כלומר הערוץ החם האמיתי הוא 291 אנשים, ומה שנבנה
// אתמול נגע בחמישה.
//
// שאול שקל להשלים כתובות דרך Hunter או Apollo. זה נדחה: אלה קשרים
// מדרגה ראשונה שהוא כבר מחובר אליהם, וניחוש כתובת עבודה של מישהו
// שאתה מכיר הוא פחות אישי מהודעה בלינקדאין, לא יותר, וגם קופץ חזרה.
//
// מה שבאמת חסם הוא החיכוך: 291 כרטיסיות ו-291 העתקות. המסך הזה הופך
// את זה לשלוש לחיצות לאדם.

const BATCH = 15;

export default function LinkedinQueue({ picks }: { picks: Pick[] }) {
  const [shown, setShown] = useState(BATCH);
  // 13.11.2026: לשונית. שאול סימן אחד עשר אנשים וחשב שרק האחרון נשמר,
  // כי ברגע שסימנת השורה יורדת לסוף רשימה בת 177 ונעלמת מהעין. כל
  // אחד עשר היו שמורים. הלשוניות הן גם הסטטיסטיקה שהוא ביקש וגם הדרך
  // לראות מה כבר עשית.
  const [tab, setTab] = useState<'open' | 'sent' | 'replied'>('open');
  // 13.11.2026: החיווי יושב על הכפתור ולא בראש הבלוק. שאול:
  // "לחיצה על העתק לא מראה סימן שלחצתי". בטלפון ראש הבלוק
  // כבר מחוץ למסך כשהוא לוחץ על שורה שביעית.
  const [copied, setCopied] = useState<string>('');
  const [msg, setMsg] = useState('');
  // 13.11.2026: הסימון חל מיד על המסך, והכתיבה למסד נמשכת ברקע. שאול:
  // "לחיצה על נשלח" לוקחת הרבה זמן. router.refresh מריץ מחדש את כל
  // השאילתות של המסך הכבד הזה, 3,000 שורות התאמה ואנשי הקשר והתור,
  // רק כדי לשנות שורה אחת ומונה אחד.
  //
  // אם הכתיבה נכשלה הסימון מוסר והשורה חוזרת לתור, כי שורה שנראית
  // שנשלחה ולא נשמרה פירושה שאול שלא פונה לאדם הזה אף פעם.
  const [localSent, setLocalSent] = useState<Record<string, string>>({});
  const [localReplied, setLocalReplied] = useState<Record<string, string>>({});

  // מי שאין לו מייל. מי שיש לו מטופל בבלוק שמעל, בשליחה אוטומטית.
  // המיון מחושב פעם אחת מהנתונים שהגיעו מהשרת, ולא מהמצב המקומי: אחרת
  // שורה שסומנה הייתה קופצת ממקומה תוך כדי שהוא עובד על הרשימה.
  const all = useMemo(
    () => picks
      .filter((p) => !p.contact.email && p.contact.linkedin_url)
      .sort((a, b) => {
        const done = (p: Pick) => (p.contact.contacted_at ? 1 : 0);
        return done(a) - done(b) || b.score - a.score;
      }),
    [picks]
  );

  const sentAt = (p: Pick) => p.contact.contacted_at || localSent[p.contact.id] || null;
  const repliedAt = (p: Pick) => p.contact.replied_at || localReplied[p.contact.id] || null;

  const open = all.filter((p) => !sentAt(p));
  const sent = all.filter((p) => sentAt(p));
  const replied = all.filter((p) => repliedAt(p));
  // אחוז מענה. פחות מעשר פניות הוא לא מדגם, ולכן הוא לא מוצג כאחוז.
  const rate = sent.length >= 10
    ? Math.round((replied.length / sent.length) * 100) : null;
  const view = tab === 'open' ? open : tab === 'sent' ? sent : replied;
  const list = view.slice(0, shown);

  async function mark(contactId: string, action: 'contacted' | 'replied') {
    const now = new Date().toISOString();
    const set = action === 'contacted' ? setLocalSent : setLocalReplied;
    set((cur) => ({ ...cur, [contactId]: now }));

    const res = await fetch('/api/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids: [contactId] }),
    }).catch(() => null);

    if (!res || !res.ok) {
      set((cur) => {
        const next = { ...cur };
        delete next[contactId];
        return next;
      });
      setMsg('לא נשמר, נסה שוב');
    }
  }

  async function copy(p: Pick) {
    const text = referralMessage({
      contactName: p.contact.full_name,
      company: p.job.company,
      jobTitle: p.job.title,
      cvId: p.job.cvId,
      attached: true,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(p.contact.id);
      setTimeout(() => setCopied((cur) => (cur === p.contact.id ? '' : cur)), 2000);
    } catch {
      setMsg('ההעתקה נכשלה');
    }
  }

  if (all.length === 0) return null;

  const btn: React.CSSProperties = {
    width: 'auto', flex: 'none', padding: '.45em .9em',
    fontSize: '.78rem', borderRadius: 6, fontWeight: 700,
  };
  const quiet: React.CSSProperties = {
    ...btn, background: 'var(--raised)', color: 'var(--muted)',
    border: '1px solid var(--hair)',
  };

  return (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 7, padding: 12, marginBottom: 14,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        פנייה בלינקדאין
      </div>

      {/* 13.11.2026: שאול ביקש מדידה. בלעדיה 291 פניות הן שלושה שבועות
          של עבודה שלו בלי לדעת אם הערוץ בכלל עובד. */}
      <div className="filters" style={{ marginBottom: 10 }}>
        {([
          ['open', 'בתור', open.length],
          ['sent', 'נשלחו', sent.length],
          ['replied', 'ענו', replied.length],
        ] as const).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            className={'filter' + (tab === key ? ' on' : '')}
            onClick={() => { setTab(key); setShown(BATCH); }}
          >
            {label}
            <span className="n">{n}</span>
          </button>
        ))}
        {rate !== null && (
          <span className="chip mute" style={{ alignSelf: 'center' }}>
            {rate}% מענה
          </span>
        )}
      </div>
      <p className="screen-note" style={{ margin: '0 0 10px' }}>
        לאנשים האלה אין כתובת מייל שמורה, אבל אתה מחובר אליהם בלינקדאין.
        לכל אחד: העתק את ההודעה, צרף את הקובץ שרשום בשורה, ואז סמן שנשלח
        כדי שירד מהתור. חמישה עשר ביום זה כל התור בשלושה שבועות.
      </p>

      {msg && <div className="chip mute" style={{ marginBottom: 8 }}>{msg}</div>}

      {list.length === 0 && (
        <p className="screen-note" style={{ margin: 0 }}>
          {tab === 'open' ? 'פנית לכולם בתור.'
            : tab === 'sent' ? 'עוד לא סימנת אף פנייה כנשלחה.'
            : 'עוד לא ענו. סמן "ענה לי" על מי שחזר אליך.'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((p) => (
          <div
            key={p.contact.id}
            style={{
              background: 'var(--raised)', border: '1px solid var(--hair)',
              borderRadius: 7, padding: 10,
              opacity: tab === 'open' && sentAt(p) && !repliedAt(p) ? 0.55 : 1,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '.86rem' }}>
              {p.contact.full_name}
            </div>
            {p.contact.title && (
              <div style={{ color: 'var(--muted)', fontSize: '.74rem' }}>
                {p.contact.title}
              </div>
            )}
            <div style={{ fontSize: '.78rem', margin: '4px 0 2px' }}>
              <b>המשרה:</b> {p.job.title} · {p.job.company}
            </div>
            {/* שורת הקובץ, באותו מבנה של "סרטון לצרף" במוקד: שם הקובץ
                בדיוק כפי שהוא נקרא אצלו, כדי שלא יצטרך לנחש איזו גרסה. */}
            <div style={{ fontSize: '.78rem', marginBottom: 8 }}>
              <b>קובץ לצרף:</b>{' '}
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.74rem' }}>
                {cvFileName(p.job.cvId)}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                style={copied === p.contact.id
                  ? { ...btn, background: 'var(--good)', color: '#fff' }
                  : btn}
                onClick={() => copy(p)}
              >
                {copied === p.contact.id ? '✓ הועתק' : 'העתק הודעה'}
              </button>
              <a
                className="apply" style={{ ...btn, textAlign: 'center' }}
                href={p.contact.linkedin_url!} target="_blank" rel="noreferrer"
              >
                פתח בלינקדאין
              </a>
              {!sentAt(p) && (
                <button
                  type="button" style={quiet}
                  onClick={() => mark(p.contact.id, 'contacted')}
                >
                  סמן שנשלח
                </button>
              )}
              {sentAt(p) && !repliedAt(p) && (
                <>
                  {/* שבב ולא כפתור כבוי: "סמן כנשלח לא מעומד". כפתור
                      מושבת נראה כמו משהו שנכשל, ובשורה הזאת הוא דווקא
                      מה שהצליח. */}
                  <span
                    className="chip ok"
                    style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}
                  >
                    ✓ נשלח
                  </span>
                  <button
                    type="button" style={quiet}
                    onClick={() => mark(p.contact.id, 'replied')}
                  >
                    ענה לי
                  </button>
                </>
              )}
              {repliedAt(p) && (
                <span className="chip ok" style={{ alignSelf: 'center' }}>
                  ✓ ענה לי
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {shown < view.length && (
        <button
          type="button" style={{ ...quiet, marginTop: 10 }}
          onClick={() => setShown(shown + BATCH)}
        >
          עוד {Math.min(BATCH, view.length - shown)} מתוך {view.length - shown}
        </button>
      )}
    </div>
  );
}
