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
  { rows, sample, cvFile, target, sentToday }:
  { rows: ReachRow[]; sample: string; cvFile: string; target: number; sentToday: number },
) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const left = Math.max(0, target - sentToday - done.size);
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
          {left === 0 ? 'סיימת להיום' : left === 1 ? 'נשארה פנייה אחת' : 'פניות נשארו היום'}
        </span>
      </div>

      <p className="hint">
        הנוסח קבוע וזהה לכולם. <b>העתק</b>, <b>פתח בלינקדאין</b>, הדבק, צרף את{' '}
        <code>{cvFile}</code>, שלח, ואז <b>סמן שנשלח</b>.
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
            <button
              type="button" className="apply" disabled={busy === r.id}
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
