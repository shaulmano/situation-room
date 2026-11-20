'use client';
import { useState } from 'react';

export type GoldRow = {
  id: string;
  name: string;
  sizeRange: string | null;
  sizeClass: string | null;
  city: string | null;
  gushDan: boolean;
  website: string | null;
  careers: string | null;
  hiring: boolean;
  contactsTotal: number;
  cvFile: string;
  jobs: { id: string; title: string; url: string | null; source: string | null }[];
  people: { id: string; name: string; title: string | null; url: string | null; message: string }[];
};

/**
 * חברות זהב. אותה צורה כמו הפנייה הרחבה: מספר שיורד, והחלטה אחת לחברה.
 * שליחה וויתור נספרים שניהם מול המכסה, ושורה יורדת מיד וחוזרת רק אם
 * הכתיבה נכשלה.
 */
export default function GoldList(
  { rows, target, doneToday }: { rows: GoldRow[]; target: number; doneToday: number },
) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const left = Math.max(0, target - doneToday - done.size);
  const live = rows.filter((r) => !done.has(r.id));

  async function mark(id: string, field: 'done' | 'skipped') {
    setBusy(id);
    setDone((p) => new Set(p).add(id));
    const res = await fetch('/api/gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: true }),
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      setDone((p) => { const n = new Set(p); n.delete(id); return n; });
      alert('לא נשמר. נסה שוב.');
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      alert('לא הצלחתי להעתיק. סמן את הטקסט ידנית.');
    }
  }

  return (
    <>
      <div className="reach-count">
        <span className="rc-n">{left}</span>
        <span className="rc-t">{left === 0 ? 'סיימת להיום' : 'חברות נשארו היום'}</span>
      </div>

      {live.length === 0 && (
        <div className="empty">
          <b>אין יותר להיום.</b>
          <p>מחר בבוקר ימתינו לך {target} חדשות.</p>
        </div>
      )}

      {live.map((r) => (
        <div className="row gold-row" key={r.id}>
          <div className="reach-who">
            <b>{r.name}</b>
            {r.sizeRange && <span className="chip mute">{r.sizeRange} עובדים</span>}
            {r.gushDan && <span className="chip mute">גוש דן</span>}
            {r.city && <span className="chip mute">{r.city}</span>}
            {r.hiring && <span className="chip mute">מגייסת</span>}
          </div>
          <div className="reach-sub">
            {r.contactsTotal} מכרים שלך כאן
            {r.jobs.length > 0 ? `, ${r.jobs.length} משרות פתוחות` : ', אין משרה ידועה'}
          </div>

          <div className="gold-links">
            {r.website && <a href={r.website} target="_blank" rel="noreferrer">אתר</a>}
            {r.careers && <a href={r.careers} target="_blank" rel="noreferrer">דף קריירה</a>}
            <a
              href={'https://www.linkedin.com/jobs/search/?keywords=' + encodeURIComponent(r.name)}
              target="_blank" rel="noreferrer"
            >משרות בלינקדאין</a>
          </div>

          {r.jobs.length > 0 && (
            <ul className="gold-jobs">
              {r.jobs.map((j) => (
                <li key={j.id}>
                  {j.url
                    ? <a href={j.url} target="_blank" rel="noreferrer">{j.title}</a>
                    : j.title}
                  {j.source && <span className="mute"> · {j.source}</span>}
                </li>
              ))}
            </ul>
          )}

          {r.people.map((p) => (
            <div className="gold-person" key={p.id}>
              <div className="gold-pn">
                <b>{p.name}</b>
                <span className="mute">{p.title}</span>
              </div>
              <div className="reach-acts">
                <button
                  type="button" className={'mark' + (copied === p.id ? ' on' : '')}
                  onClick={() => copy(p.id, p.message)}
                >{copied === p.id ? '✓ הועתק' : 'העתק הודעה'}</button>
                {p.url && (
                  <a className="apply indirect" href={p.url} target="_blank" rel="noreferrer">
                    פתח בלינקדאין
                  </a>
                )}
              </div>
            </div>
          ))}

          <p className="hint">לצרף: <code>{r.cvFile}</code></p>

          <div className="reach-acts">
            <button type="button" className="apply" disabled={busy === r.id}
              onClick={() => mark(r.id, 'done')}>סמן שנשלח</button>
            <button type="button" className="closed" disabled={busy === r.id}
              title="לא רלוונטי. יירד מהתור ולא יחזור"
              onClick={() => mark(r.id, 'skipped')}>מוותר</button>
          </div>
        </div>
      ))}
    </>
  );
}
