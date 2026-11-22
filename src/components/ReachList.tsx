'use client';
import { useState } from 'react';
import { BUCKET_LABEL, type ReachBucket } from '@/lib/wideReach';

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
  { rows, sample, cvFile, target, doneToday, sentToday, skippedToday }:
  {
    rows: ReachRow[]; sample: string; cvFile: string; target: number;
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

  // "שלח": נכנס לתור, והסוכן שולח מהמחשב. הספירה יורדת מיד, ואם השליחה
  // נכשלת הסוכן מחזיר את האדם לרשימה.
  async function queue(rs: ReachRow[]) {
    const withUrl = rs.filter((r) => r.url);
    if (withUrl.length === 0) return;
    setBusy('queue');
    withUrl.forEach((r) => setDone((p) => new Set(p).add(r.id)));
    const res = await fetch('/api/outbox', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wide: true,
        items: withUrl.map((r) => ({ contactId: r.id, url: r.url, name: r.name, message: r.message, cvFile })),
      }),
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      setDone((p) => { const n = new Set(p); withUrl.forEach((r) => n.delete(r.id)); return n; });
      alert('לא נשמר. נסה שוב.');
      return;
    }
    setQueuedN((n) => n + withUrl.length);
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

      {live.length > 0 && (
        <button type="button" className="apply reach-all" disabled={busy === 'queue'}
          onClick={() => queue(live)}>
          שלח את כל הרשימה ({live.filter((r) => r.url).length})
        </button>
      )}
      {queuedN > 0 && (
        <p className="hint"><b>{queuedN}</b> נכנסו לתור. הסוכן שולח אותם מהמחשב, עם הקובץ, ומסמן בחדר המצב.</p>
      )}

      <p className="hint">
        הנוסח קבוע וזהה לכולם. ידנית: <b>העתק</b>, <b>פתח בלינקדאין</b>, הדבק, צרף את{' '}
        <code>{cvFile}</code>, שלח, ואז <b>סמן שנשלח</b>. או לחץ <b>שלח</b> והסוכן עושה את זה.
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
          <b>אין יותר להיום.</b>
          <p>מחר בבוקר ימתינו לך {target} חדשים.</p>
        </div>
      )}

      {live.map((r) => (
        <div className="row reach-row" key={r.id}>
          <div className="reach-who">
            <b>{r.name}</b>
            <span className="chip mute">{BUCKET_LABEL[r.bucket]}</span>
          </div>
          <div className="reach-sub">
            {[r.title, r.company].filter(Boolean).join(' · ')}
          </div>
          <div className="reach-acts">
            <button
              type="button"
              className={'mark' + (copied === r.id ? ' on' : '')}
              onClick={() => copy(r)}
            >
              {copied === r.id ? '✓ הועתק' : 'העתק הודעה'}
            </button>
            {r.url && (
              <a className="apply indirect" href={r.url} target="_blank" rel="noreferrer">
                פתח בלינקדאין
              </a>
            )}
            {r.url && (
              <button type="button" className="apply" disabled={busy === 'queue'}
                onClick={() => queue([r])}>שלח</button>
            )}
            <button
              type="button" className="mark" disabled={busy === r.id}
              onClick={() => mark(r.id, 'sent')}
            >
              סמן שנשלח
            </button>
            <button
              type="button" className="closed" disabled={busy === r.id}
              title="לא רלוונטי. יירד מהתור ולא יחזור"
              onClick={() => mark(r.id, 'skipped')}
            >
              מוותר
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
