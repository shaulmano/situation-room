'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function Dismiss({ id }: { id: string }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();

  async function hide() {
    setGone(true);
    await fetch('/api/jobs/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    start(() => router.refresh());
  }

  return (
    <button
      type="button" className="dismiss" onClick={hide}
      disabled={gone || pending} title="הסתר — לא רלוונטית"
      aria-label="הסתר משרה"
    >
      ✕
    </button>
  );
}
