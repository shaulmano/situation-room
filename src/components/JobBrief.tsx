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

export type BriefJob = { id: string; title: string; company: string; url?: string | null };

export default function JobBrief({ job }: { job: BriefJob }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'copied' | 'error'>('');

  async function expand() {
    setOpen(true);
    if (loaded) return;
    // נטען רק בפתיחה. התיאורים ארוכים, ומשיכה שלהם לכל שורה בפיד הייתה
    // גוררת מאות קילובייטים על מסך שרובו לא נפתח.
    const res = await fetch(`/api/jobs/description?id=${encodeURIComponent(job.id)}`)
      .catch(() => null);
    if (res?.ok) setText(((await res.json()).description as string) || '');
    setLoaded(true);
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
    return (
      <div style={line}>
        <button type="button" style={btn} onClick={expand}>
          ◀ תיאור המשרה וקורות חיים
        </button>
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
    </div>
  );
}
