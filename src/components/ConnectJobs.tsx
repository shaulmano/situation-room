'use client';
import { useState } from 'react';
import { SECTOR_LABEL, type JobConnectRow, type Sector } from '@/lib/jobConnect';

export default function ConnectJobs({ rows, left, done, quota }: { rows: JobConnectRow[]; left: number; done: number; quota: number }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [sector, setSector] = useState<Sector | 'all' | 'none'>('all');
  const live = rows.filter((r) => !gone.has(r.key));
  // ויתור הוא עבודה, ולכן שני הכפתורים מקטינים את המכסה: אחרת כל ויתור
  // היה שואב פנימה חברה חדשה אחרי רענון.
  const remaining = Math.max(0, left - (rows.length - live.length));
  const matching = live.filter((r) =>
    sector === 'all' ? true : sector === 'none' ? r.sectors.length === 0 : r.sectors.includes(sector));
  const shown = matching.slice(0, remaining);
  const count = (f: (r: JobConnectRow) => boolean) => live.filter(f).length;

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
        <span className="rc-n">{shown.length}</span>
        <span className="rc-t">
          {shown.length === 0 ? (remaining === 0 ? 'סיימת להיום' : 'אין חברות בתחום הזה') : 'חברות עם משרה פתוחה ובלי איש קשר'}
          {' · '}טופלו היום {done + (rows.length - live.length)} מתוך {quota}
        </span>
      </div>
      {remaining === 0 && (
        <div className="empty"><b>סיימת את המכסה של היום.</b></div>
      )}
      {shown.length === 0 && remaining > 0 && sector === 'all' && (
        <div className="empty"><b>אין עכשיו חברות שעומדות בתנאים.</b>
          <p>משרה מתאימה, פתוחה, בחברה שאין בה אף איש קשר שלך.</p></div>
      )}
      <div className="filters" style={{ marginBottom: 10 }}>
        {([['all', 'הכול', live.length], ...(Object.keys(SECTOR_LABEL) as Sector[]).map((k) => [k, SECTOR_LABEL[k], count((r) => r.sectors.includes(k))]),
          ['none', 'לא סווג', count((r) => r.sectors.length === 0)]] as [Sector | 'all' | 'none', string, number][]).map(([id, label, n]) => (
          <button key={id} type="button" className={'filter' + (sector === id ? ' on' : '')}
            style={{ width: 'auto', flex: 'none', opacity: n === 0 && sector !== id ? 0.55 : 1 }}
            onClick={() => setSector(id)}>
            {label} <span className="count">{n}</span>
          </button>
        ))}
      </div>
      <div className="cn-list">
        {shown.map((r) => (
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
