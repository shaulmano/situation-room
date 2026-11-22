'use client';
import { useState } from 'react';

// "שלח": מכניס את ההודעה לתור. השליחה עצמה יוצאת מהמחשב של שאול.
export default function QueueSend(
  { contactId, url, name, message, cvFile, jobId }:
  { contactId: string; url: string; name: string; message: string; cvFile?: string; jobId?: string },
) {
  const [st, setSt] = useState<'idle' | 'busy' | 'queued'>('idle');
  async function go() {
    setSt('busy');
    const res = await fetch('/api/outbox', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, url, name, message, cvFile, jobId }),
    }).catch(() => null);
    setSt(res && res.ok ? 'queued' : 'idle');
  }
  return (
    <button type="button" className="apply" onClick={go} disabled={st !== 'idle'}
      title="נכנס לתור. ההודעה נשלחת מהמחשב שלך בריצה הבאה">
      {st === 'queued' ? '✓ בתור' : st === 'busy' ? '...' : 'שלח'}
    </button>
  );
}
