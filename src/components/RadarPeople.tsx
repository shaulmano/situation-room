'use client';
import { useState } from 'react';
import CvFilePick from '@/components/CvFilePick';

export type RadarPerson = {
  kind: 'contact' | 'find';
  id: string; name: string; title: string | null; url: string | null;
  message: string; cvFile?: string; jobId: string;
};

/**
 * מי אפשר לפנות אליו בחברה של משרת רדאר. 23.11.2026, שאול: איש קשר מאומת
 * קודם, ואם אין מגייס שנמצא בחיפוש. בלי אף אחד: אין שורה.
 */
export default function RadarPeople({ people }: { people: RadarPerson[] }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const live = people.filter((p) => !gone.has(p.id));
  if (live.length === 0) return null;

  async function copy(p: RadarPerson) {
    try {
      await navigator.clipboard.writeText(p.message);
      setCopied(p.id);
      setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 2000);
    } catch { alert('לא הצלחתי להעתיק. סמן את הטקסט ידנית.'); }
  }

  async function mark(p: RadarPerson) {
    setGone((s) => new Set(s).add(p.id));
    const res = p.kind === 'find'
      ? await fetch('/api/gold', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recruiterId: p.id, asked: true }) }).catch(() => null)
      : await fetch('/api/contacts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id, contacted: true, jobId: p.jobId }) }).catch(() => null);
    if (!res || !res.ok) {
      setGone((s) => { const n = new Set(s); n.delete(p.id); return n; });
      alert('לא נשמר. נסה שוב.');
    }
  }

  return (
    <div className="rp">
      {live.map((p) => (
        <div className="cn-card rp-card" key={p.id}>
          <div className="cn-info">
            <div className="cn-top">
              <b className="cn-name">{p.name}</b>
              <span className="cn-co">{p.kind === 'contact' ? 'מאומת, בקשרים שלך' : 'נמצא בחיפוש, לא בקשרים'}</span>
            </div>
            <div className="cn-title">{p.title}{p.kind === 'contact' && p.cvFile ? <> · לצרף: <CvFilePick file={p.cvFile} id={p.jobId} /></> : ''}</div>
          </div>
          <div className="cn-acts">
            <button type="button" className={'cn-b' + (copied === p.id ? ' on' : '')} onClick={() => copy(p)}>
              {copied === p.id ? '✓ הועתק' : p.kind === 'find' ? 'העתק הערה' : 'העתק הודעה'}
            </button>
            {p.url
              ? <a className="cn-b" href={p.url} target="_blank" rel="noreferrer">פתח בלינקדאין</a>
              : <span />}
            <button type="button" className="cn-b main" onClick={() => mark(p)}>
              {p.kind === 'find' ? 'ביקשתי חברות' : 'פניתי'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
