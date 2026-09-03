'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function MarkApplied({ id, cvId }: { id: string; cvId?: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  async function mark() {
    setDone(true);
    await fetch('/api/jobs/applied', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cv_id: cvId }),
    });
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
