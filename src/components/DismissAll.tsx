'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// Closing a whole source one row at a time is the actual complaint: a board
// that posts forty irrelevant rows a day costs forty taps. This closes the
// filtered set in one write.
//
// Two taps, not one, and not a browser confirm(): a stray tap on a phone would
// clear the screen, and a dialog is both easy to dismiss blindly and awkward in
// RTL. The button states what it is about to do and waits to be pressed again.
export default function DismissAll({ ids, label }: { ids: string[]; label: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  if (ids.length === 0) return null;

  async function run() {
    setBusy(true);
    setErr('');
    const res = await fetch('/api/jobs/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setErr('הסגירה נכשלה');
      setArmed(false);
      return;
    }
    setArmed(false);
    start(() => router.refresh());
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        className={'scanbtn' + (armed ? ' retry' : '')}
        disabled={busy || pending}
        onClick={() => (armed ? run() : setArmed(true))}
        // The count is the whole safety net: it says how much is about to go.
        title={`סוגר ${ids.length} משרות מ־${label}`}
      >
        {busy || pending
          ? 'סוגר…'
          : armed
            ? `בטוח? סגור ${ids.length}`
            : `✕ סגור את כל ${ids.length} המשרות`}
      </button>
      {armed && !busy && (
        <button type="button" className="link-btn" onClick={() => setArmed(false)}>
          ביטול
        </button>
      )}
      {err && <span className="chip crit">{err}</span>}
    </span>
  );
}
