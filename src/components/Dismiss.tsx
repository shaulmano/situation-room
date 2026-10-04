'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function Dismiss({ id, ids }: { id: string; ids?: string[] }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();

  // The write and the refetch take about a second, and the row used to sit
  // there unchanged for all of it — so on a phone the tap read as ignored.
  // Drop the row on click and let the refetch confirm it.
  async function hide(e: React.MouseEvent<HTMLButtonElement>) {
    const row = (e.currentTarget as HTMLElement).closest('.row');
    setGone(true);
    if (row instanceof HTMLElement) row.hidden = true;

    const res = await fetch('/api/jobs/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ids: ids ?? [id] }),
    }).catch(() => null);

    // Put it back if the write never landed. A job hidden on screen but still
    // in the feed is worse than one that visibly refused to go.
    if (!res || !res.ok) {
      if (row instanceof HTMLElement) row.hidden = false;
      setGone(false);
      return;
    }
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
}'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function Dismiss({ id }: { id: string }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();

  // The write and the refetch take about a second, and the row used to sit
  // there unchanged for all of it — so on a phone the tap read as ignored.
  // Drop the row on click and let the refetch confirm it.
  async function hide(e: React.MouseEvent<HTMLButtonElement>) {
    const row = (e.currentTarget as HTMLElement).closest('.row');
    setGone(true);
    if (row instanceof HTMLElement) row.hidden = true;

    const res = await fetch('/api/jobs/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);

    // Put it back if the write never landed. A job hidden on screen but still
    // in the feed is worse than one that visibly refused to go.
    if (!res || !res.ok) {
      if (row instanceof HTMLElement) row.hidden = false;
      setGone(false);
      return;
    }
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
