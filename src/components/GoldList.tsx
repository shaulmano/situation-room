'use client';
import MarkApplied from './MarkApplied';
import GoldSkipJob from './GoldSkipJob';
import { Fragment, useState } from 'react';

export type GoldRow = {
  id: string;
  /** יש בה משרה פתוחה ומכר שלך. מעל המכסה, ראשונה, בצבע בולט. */
  hot: boolean;
  /** תכלת: משרה מאומתת ואיש גיוס מאומת. צהוב: משרה מאומתת בלי איש גיוס. plain: חברה בלי משרה. */
  tier: 'blue' | 'yellow' | 'plain';
  /** כרטיס שנבנה מהמשרה, החברה אינה ברשימת הזהב ולכן אין לה החלטה ברמת חברה. */
  noCompany: boolean;
  unverifiedN: number;
  name: string;
  sizeRange: string | null;
  sizeClass: string | null;
  city: string | null;
  gushDan: boolean;
  website: string | null;
  careers: string | null;
  hiring: boolean;
  contactsTotal: number;
  peopleHref: string | null;
  recruitersHref: string;
  /** הודעה גנרית (בלי שם) למגייס שלא ברשימה, לפי הנוסח של אנשי הקשר. */
  genericMessage: string;
  cvFile: string;
  jobs: { id: string; title: string; url: string | null; source: string | null; verified: boolean; verifiedAt: string | null; location: string | null; recruiterName: string | null; recruiterUrl: string | null }[];
  people: { id: string; name: string; title: string | null; url: string | null; message: string }[];
  /** מגייסים שנמצאו בחיפוש. לא קשרים: בקשת חברות עם הערה, ואחרי אישור ההודעה עם הקובץ. */
  finds: { id: string; name: string; headline: string | null; url: string; note: string }[];
};

/**
 * חברות זהב. אותה צורה כמו הפנייה הרחבה: מספר שיורד, והחלטה אחת לחברה.
 * שליחה וויתור נספרים שניהם מול המכסה, ושורה יורדת מיד וחוזרת רק אם
 * הכתיבה נכשלה.
 */
function ago(iso: string): string {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
  return h < 1 ? 'לפני פחות משעה' : h < 24 ? `לפני ${h} שעות` : `לפני ${Math.round(h / 24)} ימים`;
}

export default function GoldList(
  { rows, target, doneToday }: { rows: GoldRow[]; target: number; doneToday: number },
) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
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

  // ויתור על איש קשר אחד. הוא יורד מיד וחוזר רק אם הכתיבה נכשלה.
  async function skipPerson(id: string) {
    setGone((p) => new Set(p).add(id));
    const res = await fetch('/api/gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: id, skipped: true }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setGone((p) => { const n = new Set(p); n.delete(id); return n; });
      alert('לא נשמר. נסה שוב.');
    }
  }

  // מגייס שנמצא בחיפוש: ביקשתי חברות, או ויתור. יורד מיד וחוזר רק אם הכתיבה נכשלה.
  async function markFind(id: string, field: 'asked' | 'skipped') {
    setGone((p) => new Set(p).add(id));
    const res = await fetch('/api/gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recruiterId: id, [field]: true }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setGone((p) => { const n = new Set(p); n.delete(id); return n; });
      alert('לא נשמר. נסה שוב.');
    }
  }

  // סגירת כרטיס שנבנה ממשרה: מוותר על כל המשרות שלו בבת אחת. הוא יורד מיד
  // וחוזר רק אם אחת הכתיבות נכשלה.
  async function closeCard(r: GoldRow) {
    setBusy(r.id);
    setDone((p) => new Set(p).add(r.id));
    const results = await Promise.all(r.jobs.map((j) =>
      fetch('/api/jobs/gold-skip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: j.id }),
      }).then((x) => x.ok).catch(() => false)));
    setBusy(null);
    if (results.some((ok) => !ok)) {
      setDone((p) => { const n = new Set(p); n.delete(r.id); return n; });
      alert('לא הכל נשמר. נסה שוב.');
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

      <div className="gold-grid">
      {live.map((r, idx) => {
        const people = r.people.filter((p) => !gone.has(p.id));
        const finds = r.finds.filter((f) => !gone.has(f.id));
        const prev = idx > 0 ? live[idx - 1].tier : null;
        const heading = r.tier !== prev
          ? (r.tier === 'blue' ? 'משרה מאומתת ואיש גיוס מאומת'
            : r.tier === 'yellow' ? 'משרה מאומתת, בלי איש גיוס מאומת'
            : 'חברות בלי משרה מאומתת')
          : null;
        return (
        <Fragment key={r.id}>
        {heading && <h3 className={'gold-tier gold-tier-' + r.tier}>{heading}</h3>}
        <div className={'gold-card ' + (r.tier === 'blue' ? 'c0' : r.tier === 'yellow' ? 'c1' : 'c2') + (r.hot ? ' gold-hot' : '')}>
          <div className="gold-head">
            <div className="reach-who">
              {r.tier === 'blue' && <span className="chip gold-hot-chip">איש גיוס מאומת</span>}
              {r.tier === 'yellow' && <span className="chip gold-hot-chip">משרה מאומתת</span>}
              <b>{r.name}</b>
            </div>
            <div className="gold-chips">
              {r.sizeRange && <span className="chip mute">{r.sizeRange} עובדים</span>}
              {r.gushDan && <span className="chip mute">גוש דן</span>}
              {r.city && <span className="chip mute">{r.city}</span>}
              {r.hiring && <span className="chip mute">מגייסת</span>}
            </div>
            <div className="reach-sub">
              {r.tier === 'blue'
                ? `${r.contactsTotal} אנשי גיוס מאומתים, ${r.jobs.length} משרות פתוחות`
                : r.tier === 'yellow'
                  ? `אין איש גיוס מאומת${r.unverifiedN > 0 ? `, ${r.unverifiedN} אנשי קשר שלא נבדקו` : ''}, ${r.jobs.length} משרות פתוחות`
                  : (r.contactsTotal > 0 ? `${r.contactsTotal} מכרים שלך כאן` : 'אין איש קשר') + ', לא ידוע על משרה'}
            </div>
          </div>

          <div className="gold-body">
          {r.jobs.map((j) => (
            <div className="gold-sec" key={j.id}>
              <h4>משרה פתוחה</h4>
              <div className="gold-jt">
                {j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.title}</a> : j.title}
              </div>
              <div className="gold-meta">
                {[j.source, j.location, j.verifiedAt ? `אומתה ${ago(j.verifiedAt)}` : null].filter(Boolean).join(' · ')}
                {j.recruiterUrl && (
                  <> · מפרסם: <a href={j.recruiterUrl} target="_blank" rel="noreferrer">{j.recruiterName || 'פתח פרופיל'}</a></>
                )}
              </div>
              <div className="gold-acts"><MarkApplied id={j.id} internal /><GoldSkipJob id={j.id} /></div>
            </div>
          ))}

          {people.map((p) => (
            <div className="gold-sec" key={p.id}>
              <h4>{r.tier === 'blue' ? 'איש גיוס מאומת' : 'איש קשר שלך'}</h4>
              <div className="gold-pn">
                <b>{p.name}</b>
                <span className="mute">{p.title}</span>
              </div>
              <div className="gold-acts three">
                <button
                  type="button" className={'mark' + (copied === p.id ? ' on' : '')}
                  onClick={() => copy(p.id, p.message)}
                >{copied === p.id ? '✓ הועתק' : 'העתק הודעה'}</button>
                {p.url
                  ? <a className="apply indirect" href={p.url} target="_blank" rel="noreferrer">פתח בלינקדאין</a>
                  : <span />}
                <button type="button" className="closed"
                  title="לא רלוונטי. יירד ולא יחזור"
                  onClick={() => skipPerson(p.id)}>מוותר</button>
              </div>
            </div>
          ))}

          {finds.map((f) => (
            <div className="gold-sec" key={f.id}>
              <h4>איש גיוס שנמצא, לא חבר שלך</h4>
              <div className="gold-pn">
                <b>{f.name}</b>
                <span className="mute">{f.headline}</span>
              </div>
              <div className="gold-meta">בקשת חברות עם הערה. את הקובץ שולחים אחרי שהוא מאשר.</div>
              <div className="gold-acts four">
                <button
                  type="button" className={'mark' + (copied === f.id ? ' on' : '')}
                  onClick={() => copy(f.id, f.note)}
                >{copied === f.id ? '✓ הועתק' : 'העתק הערה'}</button>
                <a className="apply indirect" href={f.url} target="_blank" rel="noreferrer">פתח בלינקדאין</a>
                <button type="button" className="apply" onClick={() => markFind(f.id, 'asked')}>ביקשתי חברות</button>
                <button type="button" className="closed" onClick={() => markFind(f.id, 'skipped')}>מוותר</button>
              </div>
            </div>
          ))}

          <div className="gold-sec">
            <h4>מגייס/ת שלא ברשימה</h4>
            <div className="gold-meta">לצרף: <code>{r.cvFile}</code></div>
            <div className="gold-acts">
              <button
                type="button" className={'mark' + (copied === 'g' + r.id ? ' on' : '')}
                onClick={() => copy('g' + r.id, r.genericMessage)}
              >{copied === 'g' + r.id ? '✓ הועתק' : 'העתק הודעה גנרית'}</button>
              <a className="apply indirect" href={r.recruitersHref} target="_blank" rel="noreferrer">מגייסים בחברה</a>
            </div>
          </div>

          </div>

          <details className="gold-more">
            <summary>קישורים</summary>
            <div className="gold-links">
              {r.website && <a href={r.website} target="_blank" rel="noreferrer">אתר</a>}
              {r.careers && <a href={r.careers} target="_blank" rel="noreferrer">דף קריירה</a>}
              {people.length === 0 && r.peopleHref && (
                <a href={r.peopleHref} target="_blank" rel="noreferrer">אנשי החברה בלינקדאין</a>
              )}
              <a
                href={'https://www.linkedin.com/jobs/search/?keywords=' + encodeURIComponent(r.name)}
                target="_blank" rel="noreferrer"
              >משרות בלינקדאין</a>
            </div>
          </details>

          {r.noCompany && (
            <div className="gold-acts gold-foot">
              <button type="button" className="closed" disabled={busy === r.id}
                title="מוותר על כל המשרות בכרטיס. הוא יירד ולא יחזור"
                onClick={() => closeCard(r)}>סגור את הכרטיס</button>
            </div>
          )}
          {!r.noCompany && <div className="gold-acts gold-foot">
            <button type="button" className="apply" disabled={busy === r.id}
              onClick={() => mark(r.id, 'done')}>{r.people.length ? 'סמן שנשלח' : 'סמן שטופלה'}</button>
            <button type="button" className="closed" disabled={busy === r.id}
              title="לא רלוונטי. יירד מהתור ולא יחזור"
              onClick={() => mark(r.id, 'skipped')}>מוותר</button>
          </div>}
        </div>
        </Fragment>
        );
      })}
      </div>
    </>
  );
}
