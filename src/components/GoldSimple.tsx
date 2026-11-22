'use client';
import { useState } from 'react';
import type { GoldRow } from './GoldList';

/**
 * מסך זהב בגרסה הפשוטה. 22.11.2026, שאול: "הוספנו הרבה והכל רק מסרבל".
 * שורה לכל חברה שיש בה משרה מאומתת ואיש גיוס מאומת: המשרה, האדם, העתק,
 * פתח בלינקדאין, טופל. מה שאין לו איש מאומת מקופל בשורה אחת למטה.
 * הלוגיקה שמאחורי הקלעים לא השתנתה, והמסך הישן נשאר ב-GoldList.
 */
export default function GoldSimple({ ready, waiting, dropped }: { ready: GoldRow[]; waiting: GoldRow[]; dropped: { company: string; title: string; why: string }[] }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [doneJobs, setDoneJobs] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const live = ready.filter((r) => !gone.has(r.id) && r.jobs.some((j) => !doneJobs.has(j.id)));

  const post = (url: string, body: unknown, method = 'POST') =>
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((x) => x.ok).catch(() => false);

  // טופל על משרה אחת: רושם פנייה לאיש עם המשרה הזאת ומסמן הגשה פנימית עליה.
  // שאר המשרות בכרטיס נשארות, כך שאפשר לפנות לכמה משרות באותה חברה.
  // המשרה יורדת מיד וחוזרת רק אם הכתיבה נכשלה.
  async function doneJob(r: GoldRow, jobId: string) {
    setDoneJobs((p) => new Set(p).add(jobId));
    const person = r.people[0];
    const results = await Promise.all([
      person ? post('/api/contacts', { id: person.id, contacted: true, jobId }, 'PATCH') : true,
      post('/api/jobs/applied', { id: jobId, internal: true }),
    ]);
    if (results.some((ok) => !ok)) {
      setDoneJobs((p) => { const n = new Set(p); n.delete(jobId); return n; });
      alert('לא הכל נשמר. נסה שוב.');
    }
  }

  // ויתור על משרה אחת: היא יורדת ולא חוזרת. שאר המשרות בכרטיס נשארות.
  async function dropJob(jobId: string) {
    setDoneJobs((p) => new Set(p).add(jobId));
    const ok = await post('/api/jobs/gold-skip', { id: jobId });
    if (!ok) {
      setDoneJobs((p) => { const n = new Set(p); n.delete(jobId); return n; });
      alert('לא נשמר. נסה שוב.');
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
              {r.jobs.filter((j) => !doneJobs.has(j.id)).map((j) => (
                <div className="gs-job" key={j.id}>
                  <div className="gs-jt">
                    {j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.title}</a> : j.title}
                    <span className="mute"> · {[j.location, j.source].filter(Boolean).join(' · ')}</span>
                    {j.cvFile && <div className="mute gs-cv">לצרף: <code>{j.cvFile}</code></div>}
                  </div>
                  <button type="button" className="apply gs-done" onClick={() => doneJob(r, j.id)}>טופל</button>
                  <button type="button" className="closed gs-drop" title="לא רלוונטי. המשרה הזאת תרד ולא תחזור" onClick={() => dropJob(j.id)}>מוותר</button>
                  {j.message && (
                    <button type="button" className={'mark gs-copy' + (copied === j.id ? ' on' : '')}
                      onClick={() => copy(j.id, j.message!)}>{copied === j.id ? '✓ הועתק' : 'העתק הודעה'}</button>
                  )}
                </div>
              ))}
              {p && <div className="gs-who"><b>{p.name}</b> <span className="mute">{p.title}</span></div>}
            </div>
            <div className="gs-acts">
              {p?.url && <a className="apply indirect" href={p.url} target="_blank" rel="noreferrer">פתח בלינקדאין</a>}
              <button type="button" className="closed" title="מוותר על כל המשרות שנשארו בכרטיס" onClick={() => drop(r)}>✕ כל הכרטיס</button>
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

      {dropped.length > 0 && (
        <details className="reach-msg" style={{ marginTop: '.6rem' }}>
          <summary>◀ {dropped.length} משרות בחברות עם איש גיוס מאומת שלא הוצגו, ולמה</summary>
          <ul className="reach-why">
            {dropped.map((d, i) => (
              <li key={i}><b>{d.company}</b> · {d.title.slice(0, 60)} <span className="mute">· {d.why}</span></li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
