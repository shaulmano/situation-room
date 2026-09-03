'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  total: number;
  done: number;
  status: string;
  note: string | null;
};

export default function ScanNow({ initial }: { initial: Run | null }) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const running = run?.status === 'running';

  const poll = useCallback(async () => {
    const res = await fetch('/api/scan').catch(() => null);
    if (!res?.ok) return;
    const { run: next } = await res.json();
    setRun(next);
    // Each source writes its row as it finishes, so the numbers move on their
    // own; refresh the table under it when the run ends.
    if (next?.status !== 'running') router.refresh();
  }, [router]);

  useEffect(() => {
    if (!running) return;
    // The slowest sources take minutes, so this is a progress check, not a tick.
    timer.current = setTimeout(poll, 5000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [running, run?.done, poll]);

  async function startScan() {
    setBusy(true); setErr('');
    const res = await fetch('/api/scan', { method: 'POST' }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setErr(body?.error ?? 'ההפעלה נכשלה');
      setBusy(false);
      return;
    }
    // GitHub takes a few seconds to start the job and write the run row.
    setTimeout(poll, 4000);
    setBusy(false);
  }

  const pct = run && run.total > 0 ? Math.round((run.done / run.total) * 100) : 0;

  return (
    <div className="scanbar">
      <button
        type="button" className="scanbtn" onClick={startScan}
        disabled={busy || running}
      >
        {running ? 'סורק…' : busy ? 'מפעיל…' : 'סרוק עכשיו'}
      </button>

      {running && (
        <div className="prog">
          <div className="prog-t">
            <div className="prog-b" style={{ width: `${pct}%` }} />
          </div>
          <span className="prog-n">{run!.done} / {run!.total}</span>
        </div>
      )}

      {!running && run?.status === 'failed' && (
        <span className="chip crit">{run.note ?? 'הסריקה נכשלה'}</span>
      )}

      {err && <span className="chip crit">{err}</span>}
    </div>
  );
}
