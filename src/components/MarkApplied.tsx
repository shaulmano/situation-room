'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function MarkApplied({ id, cvId }: { id: string; cvId?: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  // Same reason as Dismiss: the row leaves the feed once the application is
  // recorded, so take it off screen on the tap instead of a second later.
  async function mark(e: React.MouseEvent<HTMLButtonElement>) {
    const row = (e.currentTarget as HTMLElement).closest('.row');
    setDone(true);

    const res = await fetch('/api/jobs/applied', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cv_id: cvId }),
    }).catch(() => null);

    if (!res || !res.ok) {
      setDone(false);
      return;
    }
    if (row instanceof HTMLElement) row.hidden = true;
    start(() => router.refresh());
  }

  return (
    <button
      type="button" className="mark" onClick={mark} disabled={done || pending}
      title="סמן כהוגשה — יעבור למסך ההגשות עם תאריך היום"
    >
      {done ? '✓ נרשם' : 'הוגשה'}
    </button>
  );
}
