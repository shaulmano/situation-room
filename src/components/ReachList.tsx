'use client';
import { useState } from 'react';
import { BUCKET_LABEL, type ReachBucket } from '@/lib/wideReach';
import CvFilePick from '@/components/CvFilePick';

export type ReachRow = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  url: string | null;
  bucket: ReachBucket;
  /** ההודעה שלו, עם שמו הפרטי בפתיחה. נבנית בשרת כדי שמה שמוצג
   *  בתצוגה המקדימה ומה שמועתק יהיו אותו דבר. */
  message: string;
  /** פנייה שנייה: כבר כתבת לו והוא לא ענה. */
  followUp?: boolean;
};

/**
 * הפנייה הרחבה, מסך ייעודי.
 *
 * 15.11.2026, שאול: "אני צריך את זה בטאב נפרד עם מספר שיורד מול
 * העיניים על כל פניה ללינקדאין לאדם... אני מפריד כי אני מסודר. לא
 * רוצה את זה בבליל של כל המשימות."
 *
 * **המספר הוא העיקר כאן ולא הרשימה.** הוא יורד על כל סימון, והוא מה
 * שאומר לו מתי סיים להיום. בלעדיו זאת עוד רשימה אינסופית שאי אפשר
 * לדעת מתי גמרת איתה.
 */
export default function ReachList(
  { rows, sample, cvFile, target, doneToday, sentToday, skippedToday, exhausted, autoLeft: autoLeft0 }:
  {
    exhausted?: boolean; autoLeft?: number; rows: ReachRow[]; sample: string; cvFile: string; target: number;
    /** החלטות היום, שליחות וויתורים יחד. זה מה שמוריד את המכסה. */
    doneToday: number;
    sentToday: number;
    skippedToday: number;
  },
) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [queuedN, setQueuedN] = useState(0);
  const autoLeft = Math.max(0, (autoLeft0 ?? 0) - queuedN);

  const left = Math.max(0, target - doneToday - done.size);
  const live = rows.filter((r) => !done.has(r.id));

  async function mark(id: string, field: 'sent' | 'skipped') {
    setBusy(id);
    // השורה יורדת מיד, והיא חוזרת רק אם הכתיבה נכשלה. שורה שנעלמה
    // והכתיבה לא נחתה היא גרועה יותר משורה שסירבה לרדת: היא תחזור מחר
    // בלי שום סימן.
    setDone((prev) => new Set(prev).add(id));
    const res = await fetch('/api/reach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: true }),
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      setDone((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      alert('לא נשמר. נסה שוב.');
    }
  }

  // אישור הרשימה: נכנסת לתור, והסקריפט במחשב שולח עם הקובץ. הספירה יורדת
  // מיד, ואם הכתיבה נכשלת השורות חוזרות.
  async function queueAll() {
    const rs = live.filter((r) => r.url).slice(0, autoLeft);
    if (rs.length === 0) return;
    setBusy('queue');
    rs.forEach((r) => setDone((p) => new Set(p).add(r.id)));
    const res = await fetch('/api/reach/queue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: rs.map((r) => r.id) }),
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      setDone((p) => { const n = new Set(p); rs.forEach((r) => n.delete(r.id)); return n; });
      alert('לא נשמר. נסה שוב.');
      return;
    }
    const j = await res.json().catch(() => ({}));
    setQueuedN((n) => n + (j.queued ?? 0));
  }

  async function copy(r: ReachRow) {
    try {
      await navigator.clipboard.writeText(r.message);
      setCopied(r.id);
      setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 2000);
    } catch {
      alert('לא הצלחתי להעתיק. סמן את הטקסט ידנית.');
    }
  }

  return (
    <>
      <div className="reach-count">
        <span className="rc-n">{left}</span>
        <span className="rc-t">
          {left === 0 ? 'סיימת להיום' : left === 1 ? 'נשארה החלטה אחת' : 'נשארו היום'}
        </span>
      </div>

      {/* 18.11.2026: המספר לבדו לא אומר לו למה הוא ירד, ולכן ויתור נראה
          כאילו לא נספר. הפירוט הוא התשובה לשאלה "למה ממשיכים להגיע עוד". */}
      {doneToday > 0 && (
        <p className="hint">
          היום: <b>{sentToday}</b> נשלחו, <b>{skippedToday}</b> ויתרת.
          {' '}שניהם נספרים מתוך {target}.
        </p>
      )}

      {autoLeft > 0 && live.some((r) => r.url) && (
        <button type="button" className="apply reach-all" disabled={busy === 'queue'}
          onClick={queueAll}>
          שלח מהמחשב ({Math.min(autoLeft, live.filter((r) => r.url).length)})
        </button>
      )}
      {autoLeft === 0 && (
        <p className="hint">המכסה היומית לשליחה אוטומטית נוצלה. השאר ידנית.</p>
      )}
      {queuedN > 0 && (
        <p className="hint">
          <b>{queuedN}</b> נכנסו לתור. הסקריפט במחשב שולח אותם עם הקובץ, אחד אחד.
          אם אחת נכשלת היא חוזרת לכאן.
        </p>
      )}

      <p className="hint">
        הנוסח קבוע לפי סוג השורה (חדש או פנייה שנייה). <b>העתק</b>, <b>פתח בלינקדאין</b>, הדבק, צרף את{' '}
        <CvFilePick file={cvFile} id="reach" />, שלח, ואז <b>סמן שנשלח</b>.
        {/* 15.11.2026, שאול: "בגדול יש לי את הקובץ ב files של האייפון
            וגם בלינקדאין". לכן זה קישור קטן ולא כפתור: הוא נחוץ רק
            כשקורות החיים מתעדכנים. */}
        {' '}
        <a href="/api/reach/cv" download style={{ color: 'var(--muted)' }}>
          (להוריד שוב)
        </a>
      </p>

      <details className="reach-msg">
        <summary>◀ ההודעה שתשלח, השם הפרטי מתחלף לכל אדם</summary>
        <pre>{sample}</pre>
      </details>

      {live.length === 0 && (
        <div className="empty">
          <b>{exhausted ? 'נגמרו המגייסים במאגר.' : 'אין יותר להיום.'}</b>
          <p>{exhausted
            ? 'אין עוד מגייסים זכאים. השלב הבא (עמיתים ובכירים) ייפתח רק כשתחליט.'
            : `מחר בבוקר ימתינו לך ${target} חדשים.`}</p>
        </div>
      )}

      <div className="cn-list">
        {live.map((r) => (
          <div className="cn-card" key={r.id}>
            <div className="cn-info">
              <div className="cn-top">
                <b className="cn-name">{r.name}</b>
                <span className="chip mute">{BUCKET_LABEL[r.bucket]}</span>
                {r.followUp && <span className="chip mute">פנייה שנייה</span>}
              </div>
              <div className="cn-title">
                {[r.title, r.company].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="cn-acts">
              <button
                type="button"
                className={'cn-b' + (copied === r.id ? ' on' : '')}
                onClick={() => copy(r)}
              >
                {copied === r.id ? '✓ הועתק' : 'העתק הודעה'}
              </button>
              {r.url
                ? <a className="cn-b" href={r.url} target="_blank" rel="noreferrer">פתח בלינקדאין</a>
                : <span />}
              <button
                type="button" className="cn-b main" disabled={busy === r.id}
                onClick={() => mark(r.id, 'sent')}
              >
                סמן שנשלח
              </button>
              <button
                type="button" className="cn-b quiet" disabled={busy === r.id}
                title="לא רלוונטי. יירד מהתור ולא יחזור"
                onClick={() => mark(r.id, 'skipped')}
              >
                מוותר
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
