'use client';
import { useState } from 'react';
import { cvFileName, posterMessage, posterNote } from '@/lib/outreach';

// שלח לאלו שפרסמת היום.
//
// 13.11.2026, שאול: "על כל שליחה למשרה בלינקדאין אתה תמצא לי את המפרסם
// ותכניס אותי לשליחת הודעה פרטית. ברגע ששלחתי ולחצתי על פורסם זה עובר
// לשם ישירות".
//
// הטריגר הוא הסימון "הוגשה" ולא הסריקה: הגשה היא הדבר היחיד שרק שאול
// יודע, והיא גם מה שהופך את ההודעה לרלוונטית. בלעדיה זאת פנייה קרה
// לאדם אקראי.
//
// למה שתי הודעות: לינקדאין מתנהגת אחרת לפי מצב החיבור. למי שהוא מחובר
// אליו אפשר הודעה עם קובץ מצורף, ולמי שלא רק פתק בבקשת חברות, בלי קובץ
// ובמגבלת 200 תווים. הצגת הודעה אחת לשניהם הייתה שולחת אותו לצרף קובץ
// במקום שאין בו כפתור לצרף.

export type PosterRow = {
  /** כל המשרות של אותו מפרסם שהוגש אליהן. הפנייה אליו היא אחת. */
  jobIds: string[];
  /** המשרה האחרונה שהוגשה אליו, זאת שההודעה מדברת עליה. */
  title: string;
  company: string;
  cvId: string | null;
  foundFor: string | null;
  url: string | null;
  posterName: string;
  posterUrl: string;
  /** האם שאול מחובר אליו: הכתובת תואמת לאיש קשר מדרגה ראשונה שלו. */
  connected: boolean;
  /** שמות המשרות הנוספות של אותו מפרסם, אם יש. */
  alsoTitles: string[];
  appliedAt: string | null;
  /** הפתק בבקשת החברות יצא. רק למי ששאול לא מחובר אליו. */
  requestAt: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  skippedAt: string | null;
};

const BATCH = 10;

export default function PosterQueue({ rows }: { rows: PosterRow[] }) {
  const [shown, setShown] = useState(BATCH);
  const [tab, setTab] = useState<'open' | 'waiting' | 'sent' | 'replied' | 'skipped'>('open');
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [local, setLocal] = useState<Record<string, Partial<PosterRow>>>({});

  const key = (r: PosterRow) => r.jobIds[0];
  const at = (r: PosterRow, k: 'requestAt' | 'sentAt' | 'repliedAt' | 'skippedAt') =>
    (local[key(r)] && k in local[key(r)]!) ? (local[key(r)] as any)[k] : r[k];

  const live = rows.filter((r) => !at(r, 'skippedAt'));
  const skipped = rows.filter((r) => at(r, 'skippedAt'));
  // "בתור" הוא מה שעוד לא עשית עליו כלום. מי שהבקשה אליו יצאה יושב
  // ב"ממתין לאישור" עד שתשלח לו את ההודעה עצמה, ולא נעלם.
  const open = live.filter((r) => !at(r, 'sentAt') && !at(r, 'requestAt'));
  const waiting = live.filter((r) => at(r, 'requestAt') && !at(r, 'sentAt'));
  const sent = live.filter((r) => at(r, 'sentAt'));
  const replied = live.filter((r) => at(r, 'repliedAt'));

  const view = tab === 'open' ? open
    : tab === 'waiting' ? waiting
    : tab === 'sent' ? sent
    : tab === 'skipped' ? skipped
    : replied;
  const list = view.slice(0, shown);

  // אחוז מענה. פחות מעשר פניות הוא לא מדגם, ולכן הוא לא מוצג כאחוז.
  const rate = sent.length >= 10
    ? Math.round((replied.length / sent.length) * 100) : null;

  async function mark(
    r: PosterRow,
    action: 'request' | 'sent' | 'replied' | 'skipped',
    undo = false,
  ) {
    const field = action === 'request' ? 'requestAt'
      : action === 'sent' ? 'sentAt'
      : action === 'replied' ? 'repliedAt'
      : 'skippedAt';
    const before = at(r, field as any);
    // הסימון חל מיד על המסך והכתיבה נמשכת ברקע, כמו בתור של לינקדאין:
    // רענון של המסך הזה מריץ מחדש את כל השאילתות הכבדות שלו.
    setLocal((cur) => ({
      ...cur,
      [key(r)]: { ...cur[key(r)], [field]: undo ? null : new Date().toISOString() },
    }));
    const res = await fetch('/api/poster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids: r.jobIds, undo }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setLocal((cur) => ({ ...cur, [key(r)]: { ...cur[key(r)], [field]: before } }));
      setMsg('לא נשמר, נסה שוב');
    }
  }

  async function copy(r: PosterRow) {
    // אחרי שהבקשה יצאה והיא אושרה, אתם מחוברים, ולכן ההודעה המלאה עם
    // הקובץ. לפני זה רק הפתק.
    const text = (r.connected || at(r, 'requestAt'))
      ? posterMessage({
          contactName: r.posterName, company: r.company, jobTitle: r.title,
          foundFor: r.foundFor, cvId: r.cvId, jobUrl: r.url,
          alsoTitles: r.alsoTitles,
        })
      : posterNote({
          contactName: r.posterName, company: r.company, jobTitle: r.title,
          foundFor: r.foundFor, cvId: r.cvId,
        });
    try {
      await navigator.clipboard.writeText(text);
      setCopied((cur) => ({ ...cur, [key(r)]: true }));
    } catch {
      setMsg('ההעתקה נכשלה');
    }
  }

  if (rows.length === 0) return null;

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
      <div style={{ fontWeight: 700, marginBottom: 2 }}>
        שלח לאלו שפרסמת
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '.76rem', marginBottom: 8 }}>
        בסך הכל נשלחו {sent.length} · ענו {replied.length}
        {waiting.length > 0 && ` · ${waiting.length} ממתינות לאישור בקשה`}
      </div>

      <div className="filters" style={{ marginBottom: 10 }}>
        {([
          ['open', 'בתור', open.length],
          ['waiting', 'ממתין לאישור', waiting.length],
          ['sent', 'נשלחו', sent.length],
          ['replied', 'ענו', replied.length],
          ['skipped', 'ויתרתי', skipped.length],
        ] as const).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            className={'filter' + (tab === key ? ' on' : '')}
            style={{ width: 'auto', flex: 'none' }}
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
        משרות שסימנת כהוגשו, ושלינקדאין מציגה מי פרסם אותן. ההגשה כבר בערימה
        של המגייס, וההודעה הזאת היא מה שמוציא אותה משם. למי שאתה לא מחובר
        אליו זה בשני צעדים: קודם הפתק בבקשת החברות, ואחרי שהיא אושרה ההודעה
        עם הקובץ. הרשימה נצברת ולא מתאפסת בכל יום.
      </p>

      {msg && <div className="chip mute" style={{ marginBottom: 8 }}>{msg}</div>}

      {list.length === 0 && (
        <p className="screen-note" style={{ margin: 0 }}>
          {tab === 'open' ? 'פנית לכל המפרסמים.'
            : tab === 'waiting' ? 'אין בקשת חברות שממתינה לאישור.'
            : tab === 'sent' ? 'עוד לא סימנת אף פנייה כנשלחה.'
            : tab === 'skipped' ? 'לא ויתרת על אף אחד.'
            : 'עוד לא ענו. סמן "ענה לי" על מי שחזר אליך.'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((r) => (
          <div
            key={key(r)}
            style={{
              background: 'var(--raised)', border: '1px solid var(--hair)',
              borderRadius: 7, padding: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '.86rem' }}>
              {r.posterName}
              {!r.connected && !at(r, 'requestAt') && (
                <span className="chip mute" style={{ marginInlineStart: 6 }}>
                  לא מחובר, בקשת חברות
                </span>
              )}
              {!r.connected && at(r, 'requestAt') && !at(r, 'sentAt') && (
                <span className="chip mute" style={{ marginInlineStart: 6 }}>
                  הבקשה יצאה, שלח כשתאושר
                </span>
              )}
            </div>
            <div style={{ fontSize: '.78rem', margin: '4px 0 2px' }}>
              <b>המשרה:</b> {r.title} · {r.company}
            </div>
            {/* אותו אדם פרסם כמה משרות שהגשת אליהן. כרטיס אחד ולא שניים:
                לינקדאין מאפשרת בקשת חברות אחת, ושתי בקשות לאותו אדם הן
                בדיוק מה שגורם לו להתעלם. */}
            {r.alsoTitles.length > 0 && (
              <div style={{ color: 'var(--muted)', fontSize: '.74rem', marginBottom: 2 }}>
                {/* בלי "אצלו": רוב המפרסמים בלוחות כאן הן נשים, ושורה
                    שמניחה מין היא בדיוק מה שהוא ביקש לא לעשות. */}
                הגשת גם ל: {r.alsoTitles.join(' · ')}
              </div>
            )}
            {/* שורת הקובץ מוצגת רק כשאפשר לצרף. בבקשת חברות אין כפתור
                לצרף קובץ, ושורה שאומרת "קובץ לצרף" במקום כזה שולחת אותו
                לחפש משהו שלא קיים. */}
            {(r.connected || at(r, 'requestAt')) ? (
              <div style={{ fontSize: '.78rem', marginBottom: 8 }}>
                <b>קובץ לצרף:</b>{' '}
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.74rem' }}>
                  {cvFileName(r.cvId)}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '.74rem', color: 'var(--muted)', marginBottom: 8 }}>
                פתק קצר בבקשת החברות, בלי קובץ. הקובץ נשלח בהודעה אחרי האישור.
              </div>
            )}

            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
            }}>
              <button
                type="button"
                style={copied[key(r)]
                  ? { ...btn, background: 'var(--good)', color: '#fff' }
                  : btn}
                onClick={() => copy(r)}
              >
                {copied[key(r)] ? '✓ הועתק'
                  : (r.connected || at(r, 'requestAt')) ? 'העתק הודעה'
                  : 'העתק פתק'}
              </button>
              <a
                className="apply" style={{ ...btn, textAlign: 'center' }}
                href={r.posterUrl} target="_blank" rel="noreferrer"
              >
                פתח פרופיל
              </a>
              {/* למי שאתה לא מחובר אליו, הצעד הראשון הוא הבקשה ולא
                  ההודעה. שאול, 13.11: "בקשת חברות אני אמור לסמן נשלח?"
                  סימון אחד לשני הצעדים היה מוריד את השורה מהתור והחצי
                  השני לא היה קורה לעולם. */}
              {!r.connected && !at(r, 'requestAt') && !at(r, 'sentAt') && (
                <button type="button" style={quiet} onClick={() => mark(r, 'request')}>
                  שלחתי בקשה
                </button>
              )}
              {(r.connected || at(r, 'requestAt')) && !at(r, 'sentAt') && (
                <button type="button" style={quiet} onClick={() => mark(r, 'sent')}>
                  סמן שנשלח
                </button>
              )}
              {at(r, 'sentAt') && !at(r, 'repliedAt') && (
                <>
                  <span className="chip ok" style={{ whiteSpace: 'nowrap' }}>✓ נשלח</span>
                  <button type="button" style={quiet} onClick={() => mark(r, 'replied')}>
                    ענה לי
                  </button>
                </>
              )}
              {at(r, 'repliedAt') && <span className="chip ok">✓ ענה לי</span>}
              {tab === 'skipped' ? (
                <button type="button" style={quiet} onClick={() => mark(r, 'skipped', true)}>
                  החזר לתור
                </button>
              ) : !at(r, 'sentAt') && (
                <button type="button" style={quiet} onClick={() => mark(r, 'skipped')}>
                  מוותר
                </button>
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
