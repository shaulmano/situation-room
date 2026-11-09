'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// רישום מה שקרה אחרי ההגשה: שיחה, ראיון, דחייה, הצעה.
//
// 9.11.2026, גרסה שנייה. בראשונה ההקשה רק פתחה שורת תאריך, והרישום קרה
// בהקשה על "שמור". שאול סימן, לא לחץ שמור, ולא נשמר כלום. זאת בדיוק
// המלכודת שהוא ביקש להימנע ממנה: תנועה שצריך לזכור להשלים.
//
// עכשיו ההקשה הראשונה שומרת מיד, עם השעה הנוכחית. שורת התאריך וההערה
// נפתחות אחריה כעידון של שורה שכבר קיימת, ואפשר להתעלם מהן לגמרי.

type Props = {
  id: string; status: string;
  stage?: string | null; nextAt?: string | null; nextKind?: string | null;
};

const KIND_LABEL: Record<string, string> = {
  call: 'שיחה', interview: 'ראיון', offer: 'הצעה',
};

// שעון ישראל, בפורמט שה-input של datetime-local מבין. toISOString היה נותן
// UTC, ושעתיים פחות.
function localValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    + `T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AppStep({ id, status, stage, nextAt, nextKind }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<'' | 'call' | 'interview'>('');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState('');
  const [pending, start] = useTransition();

  async function send(body: Record<string, unknown>, label: string) {
    setSaved('שומר');
    const res = await fetch('/api/applications/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setSaved('לא נשמר, נסה שוב');
      return;
    }
    setSaved(label);
    start(() => router.refresh());
  }

  // ההקשה הזאת היא הרישום. מה שנפתח אחריה הוא רשות.
  async function mark(kind: 'call' | 'interview') {
    const now = localValue(new Date());
    setWhen(now);
    setOpen(kind);
    await send(
      { status: kind === 'interview' ? 'interview' : 'conversation', kind, at: now },
      kind === 'interview' ? 'נרשם ראיון' : 'נרשמה שיחה',
    );
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
      {/* מה שההגשה הגיעה אליו נשאר על המסך גם אחרי דחייה. */}
      {stage && (
        <span className="chip ok" style={{ alignSelf: 'center' }}>
          הגיע ל{KIND_LABEL[stage] ?? stage}
        </span>
      )}
      {nextAt && (
        <span className="chip warn" style={{ alignSelf: 'center' }}>
          {KIND_LABEL[nextKind ?? 'call'] ?? 'שיחה'}{' '}
          {new Date(nextAt).toLocaleString('he-IL', {
            day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      )}

      <button type="button" style={quiet} onClick={() => mark('call')} disabled={pending}>
        הייתה שיחה
      </button>
      <button type="button" style={quiet} onClick={() => mark('interview')} disabled={pending}>
        היה ראיון
      </button>
      {status !== 'rejected' && (
        <button type="button" style={quiet} disabled={pending}
                onClick={() => send({ status: 'rejected' }, 'נרשמה דחייה')}>
          נדחה
        </button>
      )}
      {status !== 'offer' && (
        <button type="button" style={quiet} disabled={pending}
                onClick={() => send({ status: 'offer', kind: 'offer' }, 'נרשמה הצעה')}>
          הצעה
        </button>
      )}
      {saved && <span className="chip mute" style={{ alignSelf: 'center' }}>{saved}</span>}

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
              status: open === 'interview' ? 'interview' : 'conversation',
              kind: open, at: when, note,
            }, 'עודכן')}
          >
            עדכן תאריך
          </button>
          <button type="button" style={quiet} onClick={() => setOpen('')}>סגור</button>
        </div>
      )}
    </div>
  );
}
