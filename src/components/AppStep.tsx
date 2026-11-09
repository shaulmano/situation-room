'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// רישום מה שקרה אחרי ההגשה: שיחה, ראיון, דחייה, הצעה.
//
// 9.11.2026. שאול שאל איפה הוא מכניס שיחת טלפון או ראיון. לא היה איפה:
// מסך ההגשות הציג 'שיחה' ו'ראיון' אבל שום דבר לא יכול היה לקבוע אותם.
//
// שתי תנועות ולא יותר: הקשה על "שיחה" או "ראיון" פותחת שורת תאריך, הקשה
// שנייה שומרת. דחייה היא הקשה אחת. הוא לרוב לא ליד מחשב.

type Props = { id: string; status: string; nextAt?: string | null; nextKind?: string | null };

const KIND_LABEL: Record<string, string> = { call: 'שיחה', interview: 'ראיון' };

// שעון ישראל, בפורמט שה-input של datetime-local מבין. toISOString היה נותן
// UTC, ושעתיים פחות.
function localValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    + `T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AppStep({ id, status, nextAt, nextKind }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<'' | 'call' | 'interview'>('');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState('');
  const [pending, start] = useTransition();

  async function send(body: Record<string, unknown>) {
    const res = await fetch('/api/applications/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setSaved('לא נשמר');
      return;
    }
    setOpen('');
    setSaved('נשמר');
    start(() => router.refresh());
  }

  function begin(kind: 'call' | 'interview') {
    if (open === kind) {
      setOpen('');
      return;
    }
    // ברירת מחדל: עכשיו. רוב הרישומים הם על שיחה שכבר קרתה, ואז אין מה
    // להקליד בכלל.
    if (!when) setWhen(localValue(new Date()));
    setSaved('');
    setOpen(kind);
  }

  const btn: React.CSSProperties = {
    width: 'auto', flex: 'none', padding: '.4em .8em', fontSize: '.78rem',
    borderRadius: 6, fontWeight: 700,
  };
  const quiet: React.CSSProperties = {
    ...btn, background: 'var(--raised)', color: 'var(--muted)',
    border: '1px solid var(--hair)',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: '100%', marginTop: 8 }}>
      {nextAt && (
        <span className="chip ok" style={{ alignSelf: 'center' }}>
          {KIND_LABEL[nextKind ?? 'call'] ?? 'שיחה'}{' '}
          {new Date(nextAt).toLocaleString('he-IL', {
            day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      )}

      <button type="button" style={open === 'call' ? btn : quiet}
              onClick={() => begin('call')} disabled={pending}>
        שיחת טלפון
      </button>
      <button type="button" style={open === 'interview' ? btn : quiet}
              onClick={() => begin('interview')} disabled={pending}>
        ראיון
      </button>
      {status !== 'rejected' && (
        <button type="button" style={quiet} disabled={pending}
                onClick={() => send({ status: 'rejected' })}>
          נדחה
        </button>
      )}
      {saved && (
        <span className="chip mute" style={{ alignSelf: 'center' }}>{saved}</span>
      )}

      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: '100%' }}>
          <input
            type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
            style={{ flex: '1 1 170px', minWidth: 0, padding: '.45em .6em',
                     border: '1px solid var(--line)', borderRadius: 6, font: 'inherit',
                     fontSize: '.8rem', background: 'var(--surface)', color: 'inherit' }}
          />
          <input
            type="text" value={note} placeholder="עם מי, ומה נאמר"
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: '2 1 190px', minWidth: 0, padding: '.45em .6em',
                     border: '1px solid var(--line)', borderRadius: 6, font: 'inherit',
                     fontSize: '.8rem', background: 'var(--surface)', color: 'inherit' }}
          />
          <button
            type="button" style={btn} disabled={pending || !when}
            onClick={() => send({
              // ראיון שנקבע למחר הוא עדיין 'interview': האריח סופר מגע עם
              // מגייס, ולא רק מגע שכבר קרה.
              status: open === 'interview' ? 'interview' : 'conversation',
              kind: open, at: when, note,
            })}
          >
            שמור
          </button>
        </div>
      )}
    </div>
  );
}
