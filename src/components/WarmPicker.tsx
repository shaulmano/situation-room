'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type WarmContact } from '@/lib/contacts';
import { cvFileName } from '@/lib/outreach';

// בחירת אנשי קשר לפנייה, ושליחה לתור.
//
// 12.11.2026, שאול בשיחה קולית: "אולי כדאי שזה יהיה משהו אוטומטי עם איזה
// מסך שייפתח ואני מסמן לאיזה אנשי קשר לשלוח והוא שולח את זה מאחורי
// הקלעים".
//
// מה שנבנה כאן הוא הסימון והתור בלבד. השליחה עצמה יוצאת מהג'ימייל שלו
// דרך המשימה המתוזמנת, ורק אחרי שהוא קיבל עותק בדיקה ואישר. הדף הזה לא
// שולח כלום, ולכן אי אפשר לשלוח ממנו בטעות.
//
// הערה למי שיבוא אחרי: אל תוסיף כאן כפתור "שלח עכשיו" שמדלג על הבדיקה.
// זה הכלל שחזר על עצמו יותר מכל כלל אחר בפרויקט הזה.

export type Pick = {
  contact: WarmContact;
  job: {
    id: string; title: string; company: string;
    cvId: string | null; foundFor: string | null; url: string | null;
  };
  queued: {
    id: number;
    status: string;
    subject: string | null;
    body: string | null;
    filename: string | null;
    cvReady: boolean;
  } | null;
  // הניקוד של ההתאמה. משמש רק לבחירת המשרה שתוצג לאיש הקשר הזה, בעמוד.
  score: number;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'מחכה לקורות החיים',
  test_sent: 'עותק בדיקה נשלח אליך',
  approved: 'אושר, יוצא בריצה הבאה',
  sent: 'נשלח',
  failed: 'נכשל',
  canceled: 'בוטל',
};

export default function WarmPicker({ picks }: { picks: Pick[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // רק מי שיש לו מייל יכול להישלח אוטומטית. לשאר ההודעה מוכנה להעתקה
  // בבלוק שמתחת לכל משרה, ואוטומציה בלינקדאין לא נבנית: היא עוברת דרך
  // החשבון של שאול ומסכנת חסימה.
  const mailable = useMemo(
    () => picks.filter((p) => !!p.contact.email && !p.queued),
    [picks]
  );

  const key = (p: Pick) => `${p.contact.id}|${p.job.id}`;

  function toggle(p: Pick) {
    const k = key(p);
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  async function queue() {
    const items = mailable
      .filter((p) => chosen.has(key(p)))
      .map((p) => ({
        contact_id: p.contact.id,
        contact_name: p.contact.full_name,
        contact_title: p.contact.title,
        email: p.contact.email,
        job_id: p.job.id,
        job_title: p.job.title,
        company: p.job.company,
        cv_id: p.job.cvId,
        found_for: p.job.foundFor,
        job_url: p.job.url,
      }));
    if (!items.length) return;

    setBusy(true);
    const res = await fetch('/api/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'queue', items }),
    }).catch(() => null);
    setBusy(false);

    if (!res || !res.ok) {
      setMsg('לא נשמר, נסה שוב');
      return;
    }
    const out = await res.json().catch(() => ({ queued: items.length }));
    setMsg(`${out.queued ?? items.length} נכנסו לתור. קורות החיים נוצרים, ואז תוכל לקרוא ולשלוח כאן.`);
    setChosen(new Set());
    router.refresh();
  }

  async function act(action: 'approve' | 'cancel', ids: number[]) {
    if (!ids.length) return;
    setBusy(true);
    const res = await fetch('/api/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const out = await res.json().catch(() => ({}));
      setMsg(action !== 'approve' ? 'בוטל.'
        : out.woke ? 'יוצא עכשיו. תוך דקה או שתיים יופיע אצלך ב-Sent.'
        : 'אושר. יוצא בריצה הקרובה.');
      router.refresh();
    } else {
      setMsg('לא נשמר, נסה שוב');
    }
  }

  // מה שממתין לקריאה ולשליחה. עד 12.11.2026 זה היה רק test_sent, כלומר
  // שורה שכבר יצא עליה מייל בדיקה. שאול ביקש לראות את ההודעה ואת הקובץ
  // במסך במקום במייל, ולכן גם pending נכנס לכאן.
  const toReview = picks.filter(
    (p) => p.queued && (p.queued.status === 'pending' || p.queued.status === 'test_sent'));

  const btn: React.CSSProperties = {
    width: 'auto', flex: 'none', padding: '.5em 1em',
    fontSize: '.82rem', borderRadius: 6, fontWeight: 700,
  };
  const quiet: React.CSSProperties = {
    ...btn, background: 'var(--raised)', color: 'var(--muted)',
    border: '1px solid var(--hair)',
  };

  return (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 7, padding: '12px', marginBottom: 14,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        שליחה אוטומטית במייל
      </div>
      <p className="screen-note" style={{ margin: '0 0 10px' }}>
        ‏{mailable.length} {mailable.length === 1 ? 'איש קשר שעוד לא בתור' : 'אנשי קשר שעוד לא בתור'},
        מתוך מי שיש לו כתובת מייל. מי שכבר בתור מופיע למטה ולא כאן. שורה אחת
        לאדם, על המשרה שהכי מתאימה לך אצלו: גם אם פתוחות אצלו כמה, הוא מקבל
        ממך מייל אחד. סמן את מי שתרצה, קורות החיים ייוצרו, ואז ההודעה והקובץ
        יופיעו למטה לקריאה.
      </p>

      {mailable.length === 0 ? (
        <p className="screen-note" style={{ margin: 0 }}>
          לאף אחד מאנשי הקשר כאן אין כתובת מייל שמורה. הפנייה אליהם היא בלינקדאין,
          וההודעה מוכנה להעתקה מתחת לכל משרה.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {mailable.map((p) => (
              <label
                key={key(p)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: '.84rem', cursor: 'pointer', padding: '4px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={chosen.has(key(p))}
                  onChange={() => toggle(p)}
                  style={{ width: 18, height: 18, flex: 'none', marginTop: 1 }}
                />
                <span style={{ minWidth: 0 }}>
                  {p.contact.full_name}
                  <span style={{ display: 'block', color: 'var(--muted)', fontSize: '.74rem' }}>
                    {p.job.company} · {p.job.title}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <button type="button" style={btn} disabled={busy || chosen.size === 0} onClick={queue}>
              {busy ? '…' : `הכן שליחה (${chosen.size})`}
            </button>
            <button
              type="button" style={quiet} disabled={busy}
              onClick={() => setChosen(new Set(mailable.map(key)))}
            >
              סמן הכל
            </button>
            {msg && <span className="chip mute">{msg}</span>}
          </div>
        </>
      )}

      {toReview.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--hair)', paddingTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '.86rem' }}>
            מוכנות לשליחה ({toReview.length})
          </div>
          <p className="screen-note" style={{ margin: '0 0 8px' }}>
            זאת ההודעה המדויקת שתצא, ואלה קורות החיים שיצורפו אליה. תקרא, ואם
            זה בסדר שלח. שום דבר לא יוצא בלי הלחיצה הזאת.
          </p>

          {toReview.map((p) => (
            <div
              key={key(p)}
              style={{
                background: 'var(--raised)', border: '1px solid var(--hair)',
                borderRadius: 7, padding: 10, marginBottom: 8,
              }}
            >
              {/* 12.11.2026: שתי עובדות שונות ישבו כאן באותה שורה בלי תווית,
                  התפקיד של איש הקשר ושם המשרה שהפנייה עליה. שאול קרא
                  "Doron Cohen" ומתחתיו "Director of QA" והבין שזה התפקיד
                  שלו, בזמן שהוא Senior QA Engineer. "תסביר לי את הקונפליקט
                  שאני מרגיש". עכשיו כל שדה אומר מה הוא. */}
              <div style={{ fontWeight: 700, fontSize: '.86rem' }}>
                {p.contact.full_name}
              </div>
              {p.contact.title && (
                <div style={{ color: 'var(--muted)', fontSize: '.74rem' }}>
                  {p.contact.title}
                </div>
              )}
              <div style={{ color: 'var(--muted)', fontSize: '.74rem', marginBottom: 6 }}>
                {p.contact.email}
              </div>
              <div style={{ fontSize: '.78rem', marginBottom: 4 }}>
                <b>המשרה:</b> {p.job.title} · {p.job.company}
              </div>

              {p.queued?.subject && (
                <div style={{ fontSize: '.78rem', marginBottom: 4 }}>
                  <b>נושא:</b> {p.queued.subject}
                </div>
              )}
              {/* 13.11.2026: שם הקובץ שיצורף, כמו בתור הלינקדאין. שאול
                  פתח גרסה מחוללת וכתב "זה נראה מקוצר מדי", ואז "אני צריך
                  את הקורות חיים המקוריים ששלחתי לך". עכשיו מצורף קובץ
                  הבסיס שלו, ושמו כתוב כאן כדי שיראה מראש מה יוצא. */}
              <div style={{ fontSize: '.78rem', marginBottom: 4 }}>
                <b>קובץ מצורף:</b>{' '}
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.74rem' }}>
                  {cvFileName(p.job.cvId)}
                </span>
              </div>

              {/* ההודעה עצמה, כמו שהיא. pre-wrap כדי שהשורות יישארו כפי
                  שנכתבו, ו-break-word כדי שכתובת ארוכה לא תמתח את המסך. */}
              <div
                style={{
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                  fontSize: '.8rem', lineHeight: 1.55,
                  background: 'var(--surface)', border: '1px solid var(--hair)',
                  borderRadius: 6, padding: '8px 9px', margin: '4px 0 8px',
                }}
              >
                {p.queued?.body || 'אין נוסח'}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {/* 13.11.2026: כפתור "קורות החיים" הוסר. הוא נפל להורדה
                    רגילה כשתפריט השיתוף לא היה זמין, ובאייפון הורדה כזאת
                    מציגה את ה-PDF על כל המסך בלי שום דרך לסגור אותו.
                    שאול: "אין שום אפשרות לסגור אותו מעבר ללהרוג את
                    האפליקציה".

                    הוא גם כבר לא נחוץ: הקובץ המצורף הוא קובץ הבסיס שלו,
                    שמו כתוב בשורה מעל, והוא נמצא אצלו בטלפון ובמחשב. */}
                {/* 13.11.2026, שאול אחרי שההודעה שהמתינה בתור יצאה
                    שבורה: "אני רוצה כפתור נוסף, שלח אלי לבדיקה, על כל
                    מייל, עד שארגיש בטוח שזה עובד טוב". זה הכלל שלו
                    מההתחלה, והורדתי אותו מוקדם מדי כשהעברתי את הבדיקה
                    למסך. העותק הולך אליו בלבד והשורה לא משנה מצב. */}
                <button
                  type="button" style={quiet} disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const res = await fetch('/api/outreach', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'test', ids: [p.queued!.id] }),
                    }).catch(() => null);
                    setBusy(false);
                    setMsg(res?.ok
                      ? 'עותק בדיקה בדרך אליך, תוך דקה או שתיים.'
                      : 'לא נשלח, נסה שוב');
                  }}
                >
                  שלח אלי לבדיקה
                </button>
                <button
                  type="button" style={btn}
                  disabled={busy || !p.queued?.cvReady}
                  onClick={() => act('approve', [p.queued!.id])}
                >
                  שלח
                </button>
                <button
                  type="button" style={quiet} disabled={busy}
                  onClick={() => act('cancel', [p.queued!.id])}
                >
                  בטל
                </button>
              </div>
            </div>
          ))}

          {toReview.filter((p) => p.queued?.cvReady).length > 1 && (
            <button
              type="button" style={btn} disabled={busy}
              onClick={() => act('approve',
                toReview.filter((p) => p.queued?.cvReady).map((p) => p.queued!.id))}
            >
              שלח את כולן ({toReview.filter((p) => p.queued?.cvReady).length})
            </button>
          )}
        </div>
      )}

      {picks.some((p) => p.queued && !['pending', 'test_sent'].includes(p.queued.status)) && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {picks
            .filter((p) => p.queued && !['pending', 'test_sent'].includes(p.queued!.status))
            .map((p) => (
              <span key={key(p)} className="chip mute" style={{ fontSize: '.72rem' }}>
                {p.contact.full_name}: {STATUS_LABEL[p.queued!.status] ?? p.queued!.status}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
