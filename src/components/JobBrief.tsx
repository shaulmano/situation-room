'use client';
import { useState } from 'react';

// הדבקת תיאור המשרה, ומסירה שלו לקלוד בלחיצה אחת.
//
// למה הדבקה ולא משיכה: אף סקרייפר לא מביא תיאור, ומלינקדאין, שהוא רוב הפיד,
// אי אפשר למשוך אותו בכלל. עמוד המשרה דורש התחברות, ומשיכה אוטומטית שלו היא
// הפרת תנאי שימוש. הדבקה אחת עוקפת את זה לגמרי ועובדת על כל מקור.
//
// מה זה פותח: קורות חיים מכוונים למשרה הזאת, וגם ציון אמיתי. score.py כבר
// קורא את העמודה הזאת ומוריד תקרה למשרה בלי תיאור.
//
// העיצוב פנימי בכוונה, כמו ב-JobContacts: שלושה צבעים וגבול מתוך globals.css
// עדיפים על עוד שמות מחלקה בגיליון שאיש לא פותח.
const line: React.CSSProperties = {
  // width מפורש: השורה היא flex עם wrap, ובלעדיו הבלוק מתיישב לצד הכפתורים
  // ובטלפון התיבה גולשת מהמסך. JobContacts עושה בדיוק את זה.
  width: '100%',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  padding: '6px 0',
  borderTop: '1px solid var(--hair)',
};

const btn: React.CSSProperties = {
  fontSize: '.76rem',
  fontWeight: 700,
  color: 'var(--accent)',
  background: 'transparent',
  border: '1px solid var(--accent)',
  borderRadius: 6,
  padding: '.22em .6em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const area: React.CSSProperties = {
  width: '100%',
  minHeight: 120,
  fontSize: '.8rem',
  lineHeight: 1.5,
  padding: '.5em .6em',
  border: '1px solid var(--hair)',
  borderRadius: 6,
  resize: 'vertical',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

// הפקודה שמפעילה את ההכנה מיד, במקום לחכות לאיסוף בשעה העגולה. היא מוצגת
// על השורה עצמה: אין טעם ביכולת שצריך לזכור איפה היא ואיך קוראים לה.
const RUN_NOW = 'תריץ קורות חיים';

export type BriefJob = {
  id: string;
  title: string;
  company: string;
  url?: string | null;
  cvId?: string | null;
};

type CvRequest = {
  id: number;
  status: 'pending' | 'working' | 'done' | 'error';
  filename: string | null;
  note: string | null;
};

export default function JobBrief({
  job,
  cvStatus,
}: {
  job: BriefJob;
  // מגיע מהעמוד בשאילתה אחת לכל השורות, כדי שאפשר יהיה לראות שקורות חיים
  // מוכנים בלי לפתוח כל שורה בנפרד.
  cvStatus?: CvRequest['status'] | null;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'copied' | 'error'>('');
  const [req, setReq] = useState<CvRequest | null>(null);
  const [reqMsg, setReqMsg] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function expand() {
    setOpen(true);
    if (loaded) return;
    // נטען רק בפתיחה. התיאורים ארוכים, ומשיכה שלהם לכל שורה בפיד הייתה
    // גוררת מאות קילובייטים על מסך שרובו לא נפתח.
    const [desc, cv] = await Promise.all([
      fetch(`/api/jobs/description?id=${encodeURIComponent(job.id)}`).catch(() => null),
      fetch(`/api/cv/request?job_id=${encodeURIComponent(job.id)}`).catch(() => null),
    ]);
    if (desc?.ok) setText(((await desc.json()).description as string) || '');
    if (cv?.ok) setReq(((await cv.json()).request as CvRequest) ?? null);
    setLoaded(true);
  }

  // rejectId מסומן כשזו דחייה של גרסה קיימת: הישנה מסומנת נדחתה, וההערה
  // נוסעת לבקשה החדשה.
  async function askForCv(rejectId?: number) {
    setReqMsg('');
    const res = await fetch('/api/cv/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        base_cv_id: job.cvId ?? null,
        reject_id: rejectId ?? null,
        feedback: feedback.trim() || null,
      }),
    }).catch(() => null);

    if (!res || !res.ok) {
      setReqMsg((res && (await res.json()).error) || 'הבקשה לא נרשמה');
      return;
    }
    const body = await res.json();
    setRejecting(false);
    setFeedback('');
    setReq({ id: body.request?.id, status: 'pending', filename: null, note: null });
  }

  function brief() {
    return [
      `משרה: ${job.title}`,
      `חברה: ${job.company}`,
      job.url ? `קישור: ${job.url}` : '',
      '',
      'תיאור המשרה:',
      text.trim(),
    ].filter(Boolean).join('\n');
  }

  async function saveAndCopy() {
    setState('saving');
    const res = await fetch('/api/jobs/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: job.id, description: text }),
    }).catch(() => null);

    if (!res || !res.ok) {
      setState('error');
      return;
    }
    // השמירה הצליחה גם אם ההעתקה לא. בספארי במובייל clipboard נחסם מחוץ
    // לאירוע משתמש, ואז הטקסט נשאר בתיבה ואפשר לסמן אותו ידנית.
    try {
      await navigator.clipboard.writeText(brief());
      setState('copied');
    } catch {
      setState('saved');
    }
  }

  if (!open) {
    const waiting = cvStatus === 'pending' || cvStatus === 'working';
    return (
      <div style={line}>
        <button type="button" style={btn} onClick={expand}>
          ◀ תיאור המשרה וקורות חיים
        </button>
        {cvStatus === 'done' && <span className="chip ok">קורות חיים מוכנים</span>}
        {waiting && <span className="chip mute">קורות חיים בהכנה</span>}
        {cvStatus === 'error' && <span className="chip crit">הייצור נכשל</span>}
      </div>
    );
  }

  return (
    <div style={{ ...line, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>
        הדבק כאן את תיאור המשרה מהמודעה. הוא נשמר על המשרה, ומשם קלוד מכין
        קורות חיים מותאמים.
      </div>
      <textarea
        style={area}
        value={text}
        onChange={(e) => { setText(e.target.value); setState(''); }}
        placeholder="הדבק כאן…"
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          style={btn}
          disabled={state === 'saving' || text.trim().length === 0}
          onClick={saveAndCopy}
        >
          {state === 'saving' ? 'שומר…' : 'שמור והעתק לקלוד'}
        </button>
        <button type="button" style={{ ...btn, borderColor: 'var(--hair)', color: 'var(--muted)' }}
                onClick={() => setOpen(false)}>
          סגור
        </button>
        {state === 'copied' && (
          <span className="chip ok">נשמר והועתק. הדבק לקלוד ובקש קורות חיים</span>
        )}
        {state === 'saved' && (
          <span className="chip ok">נשמר. ההעתקה נחסמה, סמן את הטקסט ידנית</span>
        )}
        {state === 'error' && <span className="chip crit">השמירה נכשלה</span>}
      </div>

      {/* ייצור קורות חיים. הכפתור רק רושם בקשה: קלוד אוסף אותה בענן, מכין
          את הגרסה וכותב אותה חזרה לכאן. אין פה המתנה מול המסך. */}
      <div style={{ borderTop: '1px solid var(--hair)', paddingTop: 8 }}>
        {!req && (
          <button
            type="button"
            style={btn}
            disabled={text.trim().length < 120}
            onClick={() => askForCv()}
            title={text.trim().length < 120 ? 'קודם הדבק ושמור את תיאור המשרה' : undefined}
          >
            ייצר קורות חיים למשרה הזאת
          </button>
        )}

        {req && (req.status === 'pending' || req.status === 'working') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="chip mute">
              הבקשה נרשמה. קלוד אוסף אותה בשעה העגולה ושולח התראה כשהקובץ מוכן
            </span>
            {/* הפקודה עצמה על השורה, ולא במקום אחר שצריך לזכור. מי שלא רוצה
                לחכות לשעה העגולה פשוט מעתיק אותה לקלוד. */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '.76rem', color: 'var(--muted)' }}>
                רוצה שזה יקרה עכשיו? כתוב לקלוד:
              </span>
              <code style={{ fontSize: '.78rem', fontWeight: 700 }}>{RUN_NOW}</code>
              <button
                type="button"
                style={btn}
                onClick={() => navigator.clipboard.writeText(RUN_NOW).catch(() => {})}
              >
                העתק
              </button>
            </div>
          </div>
        )}

        {req && req.status === 'error' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="chip crit">{req.note || 'הייצור נכשל'}</span>
            <button type="button" style={btn} onClick={() => askForCv(req.id)}>נסה שוב</button>
          </div>
        )}

        {req && req.status === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {req.filename ? (
              // קישור ולא כפתור: ההורדה היא ניווט, והדפדפן בטלפון מטפל בזה
              // נכון בלי שום קוד שלנו.
              <a
                className="apply"
                href={`/api/cv/file?id=${req.id}`}
                download={req.filename}
              >
                הורד קורות חיים
              </a>
            ) : (
              <span className="chip mute">הטקסט מוכן, הקובץ עדיין לא</span>
            )}
            <button
              type="button"
              style={{ ...btn, borderColor: 'var(--hair)', color: 'var(--muted)' }}
              onClick={() => setRejecting(!rejecting)}
            >
              {rejecting ? 'ביטול' : 'דחה וייצר שוב'}
            </button>
          </div>

          {/* ההערה היא מה שמונע מהגרסה הבאה להיות אותו דבר בניסוח אחר, ולכן
              היא מוצעת כאן ולא נדרשת: דחייה בלי הסבר עדיפה על דחייה שנתקעת. */}
          {rejecting && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                style={{ ...area, minHeight: 70 }}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="מה לשנות? לדוגמה: להדגיש ניהול תקציב, פחות על QA. אפשר להשאיר ריק"
              />
              <div>
                <button type="button" style={btn} onClick={() => askForCv(req.id)}>
                  ייצר גרסה חדשה
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {reqMsg && <span className="chip crit">{reqMsg}</span>}
      </div>
    </div>
  );
}
