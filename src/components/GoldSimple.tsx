'use client';
import { useState } from 'react';
import type { GoldRow } from './GoldList';

/**
 * מסך זהב בגרסה הפשוטה. 22.11.2026, שאול: "הוספנו הרבה והכל רק מסרבל".
 * שורה לכל חברה שיש בה משרה מאומתת ואיש גיוס מאומת: המשרה, האדם, העתק,
 * פתח בלינקדאין, טופל. מה שאין לו איש מאומת מקופל בשורה אחת למטה.
 * הלוגיקה שמאחורי הקלעים לא השתנתה, והמסך הישן נשאר ב-GoldList.
 */
export default function GoldSimple({ ready, waiting }: { ready: GoldRow[]; waiting: GoldRow[] }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const live = ready.filter((r) => !gone.has(r.id));

  const post = (url: string, body: unknown, method = 'POST') =>
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((x) => x.ok).catch(() => false);

  // טופל: רושם פנייה לאיש עם המשרה, מסמן הגשה פנימית על המשרה הראשית,
  // וסוגר את שאר המשרות בכרטיס. השורה יורדת מיד וחוזרת רק אם משהו נכשל.
  async function done(r: GoldRow) {
    setGone((p) => new Set(p).add(r.id));
    const [top, ...rest] = r.jobs;
    const person = r.people[0];
    const results = await Promise.all([
      person && top ? post('/api/contacts', { id: person.id, contacted: true, jobId: top.id }, 'PATCH') : true,
      top ? post('/api/jobs/applied', { id: top.id, internal: true }) : true,
      ...rest.map((j) => post('/api/jobs/gold-skip', { id: j.id })),
    ]);
    if (results.some((ok) => !ok)) {
      setGone((p) => { const n = new Set(p); n.delete(r.id); return n; });
      alert('לא הכל נשמר. נסה שוב.');
    }
  }

  // ✕: לא רלוונטי. כל המשרות בכרטיס יורדות ולא חוזרות.
  async function drop(r: GoldRow) {
    setGone((p) => new Set(p).add(r.id));
    const results = await Promise.all(r.jobs.map((j) => post('/api/jobs/gold-skip', { id: j.id })));
    if (results.some((ok) => !ok)) {
      setGone((p) => { const n = new Set(p); n.delete(r.id); return n; });
      alert('לא נשמר. נסה שוב.');
    }
  }

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch { alert('לא הצלחתי להעתיק. סמן את הטקסט ידנית.'); }
  }

  return (
    <>
      <div className="reach-count">
        <span className="rc-n">{live.length}</span>
        <span className="rc-t">{live.length === 0 ? 'אין כרגע משרה עם איש גיוס מאומת' : 'משרות מוכנות לפנייה'}</span>
      </div>

      {live.map((r) => {
        const p = r.people[0];
        return (
          <div className="row gold-simple" key={r.id}>
            <div className="gs-main">
              <b>{r.name}</b>
              {r.jobs.map((j) => (
                <div className="gs-job" key={j.id}>
                  {j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.title}</a> : j.title}
                  <span className="mute"> · {[j.location, j.source].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
              {p && <div className="gs-who"><b>{p.name}</b> <span className="mute">{p.title}</span></div>}
              <div className="mute gs-cv">לצרף: <code>{r.cvFile}</code></div>
            </div>
            <div className="gs-acts">
              {p && (
                <button type="button" className={'mark' + (copied === r.id ? ' on' : '')}
                  onClick={() => copy(r.id, p.message)}>{copied === r.id ? '✓ הועתק' : 'העתק הודעה'}</button>
              )}
              {p?.url && <a className="apply indirect" href={p.url} target="_blank" rel="noreferrer">פתח בלינקדאין</a>}
              <button type="button" className="apply" onClick={() => done(r)}>טופל</button>
              <button type="button" className="closed" title="לא רלוונטי. יירד ולא יחזור" onClick={() => drop(r)}>✕</button>
            </div>
          </div>
        );
      })}

      {waiting.length > 0 && (
        <details className="reach-msg" style={{ marginTop: '1rem' }}>
          <summary>◀ {waiting.length} משרות מחכות לבדיקת איש גיוס</summary>
          <ul className="reach-why">
            {waiting.map((r) => (
              <li key={r.id}>
                <b>{r.name}</b>
                {r.jobs.slice(0, 3).map((j) => (
                  <span key={j.id}> · {j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.title}</a> : j.title}</span>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
