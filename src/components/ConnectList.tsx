'use client';
import { useState } from 'react';

export type ConnectRow = {
  id: string; name: string; headline: string | null; url: string;
  company: string; sizeClass: string | null; note: string;
};

export default function ConnectList({ rows }: { rows: ConnectRow[] }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const live = rows.filter((r) => !gone.has(r.id));

  async function mark(id: string, field: 'asked' | 'skipped') {
    setGone((p) => new Set(p).add(id));
    const res = await fetch('/api/gold', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recruiterId: id, [field]: true }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setGone((p) => { const n = new Set(p); n.delete(id); return n; });
      alert('לא נשמר. נסה שוב.');
    }
  }

  async function copy(r: ConnectRow) {
    try {
      await navigator.clipboard.writeText(r.note);
      setCopied(r.id);
      setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 2000);
    } catch { alert('לא הצלחתי להעתיק. סמן את הטקסט ידנית.'); }
  }

  return (
    <>
      <div className="reach-count">
        <span className="rc-n">{live.length}</span>
        <span className="rc-t">{live.length === 0 ? 'אין מגייסים ממתינים' : 'ממתינים לבקשת חברות'}</span>
      </div>
      {live.length === 0 && (
        <div className="empty">
          <b>אין עדיין מגייסים ברשימה.</b>
          <p>החיפוש במחשב מוסיף אותם בכל ריצה.</p>
        </div>
      )}
      <div className="cn-list">
        {live.map((r) => (
          <div className="cn-card" key={r.id}>
            <div className="cn-info">
              <div className="cn-top">
                <b className="cn-name">{r.name}</b>
                <span className="cn-co">{r.company}</span>
              </div>
              <div className="cn-title">{r.headline}</div>
            </div>
            <div className="cn-acts">
              <button type="button" className={'cn-b' + (copied === r.id ? ' on' : '')} onClick={() => copy(r)}>
                {copied === r.id ? '✓ הועתק' : 'העתק הערה'}
              </button>
              <a className="cn-b" href={r.url} target="_blank" rel="noreferrer">פתח בלינקדאין</a>
              <button type="button" className="cn-b main" onClick={() => mark(r.id, 'asked')}>ביקשתי</button>
              <button type="button" className="cn-b quiet" onClick={() => mark(r.id, 'skipped')}>מוותר</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
