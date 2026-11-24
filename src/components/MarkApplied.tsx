'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function MarkApplied({ id, cvId, internal }: { id: string; cvId?: string; internal?: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  // 24.11.2026: הגשה פנימית שואלת למי פנית, כדי שהמגייס ייכנס ל"ממתין לאישור"
  // ויהיה מקושר למשרה. בלי זה הגשה פנימית הייתה נרשמת בלי שום שם.
  const [ask, setAsk] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  // Same reason as Dismiss: the row leaves the feed once the application is
  // recorded, so take it off screen on the tap instead of a second later.
  async function mark(e: React.MouseEvent<HTMLButtonElement>, withRecruiter = false) {
    const row = (e.currentTarget as HTMLElement).closest('.row');
    setDone(true);

    const res = await fetch('/api/jobs/applied', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id, cv_id: cvId, internal: !!internal,
        ...(withRecruiter && url.trim() ? { recruiter_url: url.trim(), recruiter_name: name.trim() } : {}),
      }),
    }).catch(() => null);

    if (!res || !res.ok) {
      setDone(false);
      return;
    }
    // 11.11.2026: hidden לבד לא הסתיר כלום, כי .row מגדיר display:flex
    // וכלל מחלקה גובר על התכונה. השורה נעלמה רק כשהרענון הסתיים.
    if (row instanceof HTMLElement) {
      row.hidden = true;
      row.style.display = 'none';
    }
    start(() => router.refresh());
  }

  if (internal && ask && !done) {
    return (
      <span style={{ display: 'block', width: '100%', padding: 10, border: '1px solid var(--btn-line, #c9d3dd)', borderRadius: 10, background: 'rgba(255,255,255,.55)' }}>
        <b style={{ display: 'block', marginBottom: 6 }}>למי פנית? (בקשת חברות ששלחת)</b>
        <input
          dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="קישור לפרופיל של מי שפנית אליו"
          style={{ width: '100%', marginBottom: 6 }}
        />
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="שם (לא חובה)"
          style={{ width: '100%', marginBottom: 6 }}
        />
        <button type="button" className="mark" disabled={pending || !url.trim()} onClick={(e) => mark(e, true)}>
          סמן שנשלחה בקשה
        </button>{' '}
        <button type="button" className="mark" disabled={pending} onClick={(e) => mark(e, false)}>
          בלי מגייס
        </button>
      </span>
    );
  }

  return (
    <button
      type="button" className="mark" onClick={internal ? () => setAsk(true) : mark} disabled={done || pending}
      title={internal
        ? 'סמן כהוגש פנימית, דרך מי שעובד שם. יעבור למסך ההגשות ויספר כהגשה פנימית'
        : 'סמן כהוגשה — יעבור למסך ההגשות עם תאריך היום'}
    >
      {done ? '✓ נרשם' : internal ? 'הוגש פנימית' : 'הוגשה'}
    </button>
  );
}
