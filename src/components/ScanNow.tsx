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

// GitHub takes 30-60s to pick up a dispatch and write the first row, and the
// first version stopped polling the moment it saw the previous finished run —
// so the bar never appeared and the button read as dead. Keep watching for a
// run newer than the one we started with.
const WAIT_MS = 180_000;

export default function ScanNow({ initial }: { initial: Run | null }) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(initial);
  const [waiting, setWaiting] = useState(false);
  const [err, setErr] = useState('');
  const startedAt = useRef<number>(0);
  const baseline = useRef<string | null>(initial?.id ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNew = run?.id && run.id !== baseline.current;
  const running = isNew ? run!.status === 'running' : false;
  const active = waiting || running;

  const poll = useCallback(async () => {
    const res = await fetch('/api/scan', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) {
      const { run: next } = await res.json();
      if (next) {
        setRun(next);
        if (next.id !== baseline.current) {
          setWaiting(false);
          if (next.status !== 'running') { router.refresh(); return; }
        }
      }
    }
    if (Date.now() - startedAt.current > WAIT_MS && !running) {
      setWaiting(false);
      setErr('הסריקה לא התחילה. בדוק ב-GitHub Actions.');
      return;
    }
    timer.current = setTimeout(poll, 5000);
  }, [router, running]);

  useEffect(() => {
    if (!active) return;
    timer.current = setTimeout(poll, 5000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [active, run?.done, poll]);

  async function startScan() {
    setErr('');
    setWaiting(true);
    startedAt.current = Date.now();
    baseline.current = run?.id ?? null;

    const res = await fetch('/api/scan', { method: 'POST' }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setErr(body?.error ?? 'ההפעלה נכשלה');
      setWaiting(false);
    }
  }

  const pct = isNew && run!.total > 0 ? Math.round((run!.done / run!.total) * 100) : 0;

  return (
    <div className="scanbar">
      <button type="button" className="scanbtn" onClick={startScan} disabled={active}>
        {running ? 'סורק…' : waiting ? 'ממתין ל-GitHub…' : 'סרוק עכשיו'}
      </button>

      {active && (
        <div className="prog">
          <div className="prog-t">
            <div
              className={'prog-b' + (waiting ? ' indeterminate' : '')}
              style={waiting ? undefined : { width: `${pct}%` }}
            />
          </div>
          <span className="prog-n">
            {running ? `${run!.done} / ${run!.total}` : 'מתחיל'}
          </span>
        </div>
      )}

      {!active && isNew && run?.status === 'failed' && (
        <span className="chip crit">{run.note ?? 'הסריקה נכשלה'}</span>
      )}
      {err && <span className="chip crit">{err}</span>}
    </div>
  );
}
