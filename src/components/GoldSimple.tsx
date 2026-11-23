'use client';
import { useState } from 'react';
import type { GoldRow } from './GoldList';
import { goldMultiMessage } from '@/lib/gold';

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

  // טופל: הודעה אחת נשלחה לאיש על כל המשרות שנשארו בכרטיס. נרשמת פנייה אחת לאיש,
  // והגשה פנימית נפרדת לכל משרה, כדי שהספירה תישאר נכונה. הכרטיס יורד מיד
  // וחוזר רק אם משהו נכשל.
  async function doneCard(r: GoldRow) {
    const jobs = r.jobs.filter((j) => !doneJobs.has(j.id));
    if (!jobs.length) return;
    setDoneJobs((p) => { const n = new Set(p); jobs.forEach((j) => n.add(j.id)); return n; });
    const person = r.people[0];
    const results = await Promise.all([
      person ? post('/api/contacts', { id: person.id, contacted: true, jobId: jobs[0].id }, 'PATCH') : true,
      ...jobs.map((j) => post('/api/jobs/applied', { id: j.id, internal: true })),
    ]);
    if (results.some((ok) => !ok)) {
      setDoneJobs((p) => { const n = new Set(p); jobs.forEach((j) => n.delete(j.id)); return n; });
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
        const jobs = r.jobs.filter((j) => !doneJobs.has(j.id));
        const files = [...new Set(jobs.map((j) => j.cvFile).filter(Boolean))] as string[];
        const message = goldMultiMessage({
          contactName: p?.name ?? '', contactTitle: p?.title ?? 'Recruiter', company: r.name,
          jobs: jobs.map((j) => ({ title: j.title, url: j.url, foundFor: j.foundFor ?? null })),
        });
        return (
          <div className="gold-simple cn-card" key={r.id}>
            <div className="cn-info">
            <div className="gs-co">
              <b>{r.name}</b>
            </div>
            {p && <div className="gs-who"><b>{p.name}</b> <span className="mute">{p.title}</span></div>}
            {jobs.map((j) => (
              <div className="gs-job" key={j.id}>
                <div className="gs-jt">
                  {j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.title}</a> : j.title}
                  <span className="mute"> · {[j.location, j.source].filter(Boolean).join(' · ')}</span>
                  {files.length > 1 && j.cvFile && <div className="mute gs-cv">לצרף: <code>{j.cvFile}</code></div>}
                </div>
                <button type="button" className="cn-b quiet gs-drop" title="לא רלוונטי. המשרה הזאת תרד ולא תחזור, וגם לא תופיע בהודעה"
                  onClick={() => dropJob(j.id)}>מוותר</button>
              </div>
            ))}
            {files.length === 1 && <div className="mute gs-cv">לצרף: <code>{files[0]}</code></div>}
            </div>
            <div className="cn-acts gs-acts4">
              <button type="button" className={'cn-b' + (copied === r.id ? ' on' : '')}
                onClick={() => copy(r.id, message)}>
                {copied === r.id ? '✓ הועתק' : jobs.length > 1 ? `העתק הודעה (${jobs.length})` : 'העתק הודעה'}
              </button>
              {p?.url
                ? <a className="cn-b" href={p.url} target="_blank" rel="noreferrer">פתח בלינקדאין</a>
                : <span />}
              <button type="button" className="cn-b quiet" title="מוותר על כל המשרות שנשארו בכרטיס"
                onClick={() => drop(r)}>מוותר על הכל</button>
              <button type="button" className="cn-b main" onClick={() => doneCard(r)}>טופל</button>
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
