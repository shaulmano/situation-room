'use client';
import { useState } from 'react';

// מוותר על משרה אחת בכרטיס זהב. לא נוגע ב-dismissed_at של המסכים הרגילים.
export default function GoldSkipJob({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  async function skip(e: React.MouseEvent<HTMLButtonElement>) {
    const sec = (e.currentTarget as HTMLElement).closest('.gold-sec');
    setDone(true);
    const res = await fetch('/api/jobs/gold-skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    if (!res || !res.ok) { setDone(false); return; }
    if (sec instanceof HTMLElement) { sec.hidden = true; sec.style.display = 'none'; }
  }
  return (
    <button type="button" className="mark" onClick={skip} disabled={done}
      title="מוותר על המשרה הזאת בלבד">
      {done ? '✓ ויתרתי' : 'מוותר'}
    </button>
  );
}
