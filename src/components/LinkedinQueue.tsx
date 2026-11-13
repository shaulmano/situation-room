'use client';
import { useMemo, useState } from 'react';
import { cvFileName, isRecruiter, referralMessage } from '@/lib/outreach';
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
  const [tab, setTab] = useState<'open' | 'sent' | 'replied' | 'skipped'>('open');
  // 13.11.2026, שאול: "אני רוצה פה פילטרים לפי מגייסים או אחרים".
  // שני סוגי פנייה שונים לגמרי: למגייסת מבקשים להסתכל, ולעובד מבקשים
  // להעביר הלאה. הוא רוצה לעבוד על קבוצה אחת ברצף ולא לקפוץ ביניהן.
  const [who, setWho] = useState<'all' | 'recruiters' | 'others'>('all');
  // 13.11.2026: החיווי יושב על הכפתור ולא בראש הבלוק. שאול:
  // "לחיצה על העתק לא מראה סימן שלחצתי". בטלפון ראש הבלוק
  // כבר מחוץ למסך כשהוא לוחץ על שורה שביעית.
  const [copied, setCopied] = useState<Record<string, boolean>>({});
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
  const [localSkipped, setLocalSkipped] = useState<Record<string, boolean>>({});

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

  const byWho = (p: Pick) => who === 'all'
    || (who === 'recruiters') === isRecruiter(p.contact.title);
  const isSkipped = (p: Pick) => (p.contact.id in localSkipped)
    ? localSkipped[p.contact.id]
    : !!p.contact.skipped_at;
  const sentAt = (p: Pick) => p.contact.contacted_at || localSent[p.contact.id] || null;
  const repliedAt = (p: Pick) => p.contact.replied_at || localReplied[p.contact.id] || null;

  // הספירה בלשוניות היא תמיד בתוך הפילוח שנבחר, אחרת "בתור 155" בזמן
  // שמוצגות שבע שורות הוא מספר שמשקר.
  const inScope = all.filter(byWho);
  const skipped = inScope.filter(isSkipped);
  // מי שוויתרת עליו יוצא מכל השאר, וגם מאחוז המענה: הוא לא נשלח.
  const live = inScope.filter((p) => !isSkipped(p));
  const open = live.filter((p) => !sentAt(p));
  const sent = live.filter((p) => sentAt(p));
  const replied = live.filter((p) => repliedAt(p));
  const recruiters = all.filter((p) => isRecruiter(p.contact.title));

  // 13.11.2026: הסיכום הכולל, תמיד, בלי קשר לפילוח. שאול ראה "נשלחו 26"
  // בזמן ש"אחרים" היה מסומן וכתב "יש לך טעות בחישוב, שלחתי מעל 50".
  // המספר היה נכון ל-26 שאינם מגייסים, ובסך הכל היו 38, אבל הוא ענה
  // על שאלה אחרת מזו שהוא שאל. מספר מפולח שנראה כמו סך הכל הוא מלכודת.
  const allLive = all.filter((p) => !isSkipped(p));
  const totalSent = allLive.filter(sentAt).length;
  const totalReplied = allLive.filter(repliedAt).length;
  const scoped = who !== 'all';
  // אחוז מענה. פחות מעשר פניות הוא לא מדגם, ולכן הוא לא מוצג כאחוז.
  const rate = sent.length >= 10
    ? Math.round((replied.length / sent.length) * 100) : null;
  const view = tab === 'open' ? open
    : tab === 'sent' ? sent
    : tab === 'skipped' ? skipped
    : replied;
  const list = view.slice(0, shown);

  async function skip(contactId: string, undo = false) {
    setLocalSkipped((cur) => ({ ...cur, [contactId]: !undo }));
    const res = await fetch('/api/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skipped', ids: [contactId], undo }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setLocalSkipped((cur) => ({ ...cur, [contactId]: undo }));
      setMsg('לא נשמר, נסה שוב');
    }
  }

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
      contactTitle: p.contact.title,
      foundFor: p.job.foundFor,
      jobUrl: p.job.url,
      attached: true,
    });
    try {
      await navigator.clipboard.writeText(text);
      // 13.11.2026: הסימון נשאר, לא נעלם אחרי שתי שניות. שאול: "הכפתור
      // העתק נעלם ההעתק אחרי שניה". בין ההעתקה לשליחה הוא עובר ללינקדאין,
      // מדביק ומצרף קובץ, וכשהוא חוזר הוא צריך לדעת על מי כבר עבד.
      setCopied((cur) => ({ ...cur, [p.contact.id]: true }));
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
      <div style={{ fontWeight: 700, marginBottom: 2 }}>
        פנייה בלינקדאין
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '.76rem', marginBottom: 8 }}>
        בסך הכל נשלחו {totalSent} · ענו {totalReplied}
        {scoped && ' · המספרים למטה הם בתוך הפילוח שבחרת'}
      </div>

      {/* 13.11.2026: שאול ביקש מדידה. בלעדיה 291 פניות הן שלושה שבועות
          של עבודה שלו בלי לדעת אם הערוץ בכלל עובד. */}
      <div className="filters" style={{ marginBottom: 10 }}>
        {([
          ['open', 'בתור', open.length],
          ['sent', 'נשלחו', sent.length],
          ['replied', 'ענו', replied.length],
          ['skipped', 'ויתרתי', skipped.length],
        ] as const).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            className={'filter' + (tab === key ? ' on' : '')}
            // רוחב אוטומטי: כפתור במערכת הזאת תופס כברירת מחדל את כל
            // הרוחב, ולכן שלוש הלשוניות נערמו אחת מתחת לשנייה.
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

      <div className="filters" style={{ marginBottom: 10 }}>
        {([
          ['all', 'הכל', all.length],
          ['recruiters', 'מגייסים', recruiters.length],
          ['others', 'אחרים', all.length - recruiters.length],
        ] as const).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            className={'filter' + (who === key ? ' on' : '')}
            style={{ width: 'auto', flex: 'none' }}
            onClick={() => { setWho(key); setShown(BATCH); }}
          >
            {label}
            <span className="n">{n}</span>
          </button>
        ))}
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
            : tab === 'skipped' ? 'לא ויתרת על אף אחד.'
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
                {isRecruiter(p.contact.title) && (
                  <span className="chip mute" style={{ marginInlineStart: 6 }}>
                    מגייס, נוסח אחר
                  </span>
                )}
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

            {/* alignItems על השורה ולא alignSelf על כל שבב: הכפתורים
                גבוהים מהשבבים בגלל הריפוד, ובלי זה השבב נצמד לראש
                השורה. "הכפתור של נשלח לא מיושר". */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
            }}>
              <button
                type="button"
                style={copied[p.contact.id]
                  ? { ...btn, background: 'var(--good)', color: '#fff' }
                  : btn}
                onClick={() => copy(p)}
              >
                {copied[p.contact.id] ? '✓ הועתק' : 'העתק הודעה'}
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
                  <span className="chip ok" style={{ whiteSpace: 'nowrap' }}>
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
                <span className="chip ok">✓ ענה לי</span>
              )}
              {/* ויתור. מופיע רק על מי שעוד לא פנית אליו, כי אין טעם
                  לוותר על משהו שכבר יצא. בלשונית "ויתרתי" הוא הופך
                  להחזרה, כדי שלחיצה בטעות לא תהיה סופית. */}
              {tab === 'skipped' ? (
                <button type="button" style={quiet} onClick={() => skip(p.contact.id, true)}>
                  החזר לתור
                </button>
              ) : !sentAt(p) && (
                <button type="button" style={quiet} onClick={() => skip(p.contact.id)}>
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
