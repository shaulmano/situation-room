'use client';
import { useState } from 'react';
import type { JobConnectRow } from '@/lib/jobConnect';

export default function ConnectJobs({ rows, left, done, quota }: { rows: JobConnectRow[]; left: number; done: number; quota: number }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const live = rows.filter((r) => !gone.has(r.key));
  // ויתור הוא עבודה, ולכן שני הכפתורים מקטינים את המכסה: אחרת כל ויתור
  // היה שואב פנימה חברה חדשה אחרי רענון.
  const remaining = Math.max(0, left - (rows.length - live.length));

  async function mark(r: JobConnectRow, field: 'asked' | 'skipped') {
    setGone((p) => new Set(p).add(r.key));
    const res = await fetch('/api/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyKey: r.key, company: r.company, jobId: r.jobId, [field]: true }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setGone((p) => { const n = new Set(p); n.delete(r.key); return n; });
      alert('לא נשמר. נסה שוב.');
    }
  }

  async function copy(r: JobConnectRow) {
    try {
      await navigator.clipboard.writeText(r.note);
      setCopied(r.key);
      setTimeout(() => setCopied((c) => (c === r.key ? null : c)), 2000);
    } catch { alert('לא הצלחתי להעתיק. סמן את הטקסט ידנית.'); }
  }

  return (
    <>
      <div className="reach-count">
        <span className="rc-n">{live.length}</span>
        <span className="rc-t">
          {live.length === 0 ? 'סיימת להיום' : 'חברות עם משרה פתוחה ובלי איש קשר'}
          {' · '}טופלו היום {done + (rows.length - live.length)} מתוך {quota}
        </span>
      </div>
      {live.length === 0 && remaining === 0 && (
        <div className="empty"><b>סיימת את המכסה של היום.</b></div>
      )}
      {live.length === 0 && remaining > 0 && (
        <div className="empty"><b>אין עכשיו חברות שעומדות בתנאים.</b>
          <p>משרה מתאימה, פתוחה, בחברה שאין בה אף איש קשר שלך.</p></div>
      )}
      <div className="cn-list">
        {live.map((r) => (
          <div className="cn-card" key={r.key}>
            <div className="cn-info">
              <div className="cn-top">
                <b className="cn-name">{r.company}</b>
                <span className="cn-co">לפני {r.ageDays} ימים</span>
              </div>
              <div className="cn-title">
                {r.jobUrl
                  ? <a href={r.jobUrl} target="_blank" rel="noreferrer">{r.jobTitle}</a>
                  : r.jobTitle}
              </div>
              <div className="cn-title">אין לך אף איש קשר בחברה</div>
            </div>
            <div className="cn-acts">
              <button type="button" className={'cn-b' + (copied === r.key ? ' on' : '')} onClick={() => copy(r)}>
                {copied === r.key ? '✓ הועתק' : 'העתק הערה'}
              </button>
              <a className="cn-b" href={r.searchHref} target="_blank" rel="noreferrer">חפש מגייסים</a>
              <button type="button" className="cn-b main" onClick={() => mark(r, 'asked')}>ביקשתי</button>
              <button type="button" className="cn-b quiet" onClick={() => mark(r, 'skipped')}>מוותר</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
