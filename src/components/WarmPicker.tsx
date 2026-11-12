'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type WarmContact } from '@/lib/contacts';

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
  job: { id: string; title: string; company: string; cvId: string | null };
  queued: { id: number; status: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'בתור, עותק בדיקה בדרך',
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
        email: p.contact.email,
        job_id: p.job.id,
        job_title: p.job.title,
        company: p.job.company,
        cv_id: p.job.cvId,
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
    setMsg(`${out.queued ?? items.length} נכנסו לתור. עותק בדיקה יגיע אליך.`);
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
      setMsg(action === 'approve' ? 'אושר. יוצא בריצה הבאה.' : 'בוטל.');
      router.refresh();
    } else {
      setMsg('לא נשמר, נסה שוב');
    }
  }

  const waiting = picks.filter((p) => p.queued?.status === 'test_sent');

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
        מתוך אנשי הקשר כאן, ל-{mailable.length} יש כתובת מייל. סמן את מי שתרצה,
        וקורות החיים לפי המשרה יישלחו מהמייל שלך כקובץ מצורף. עותק בדיקה מגיע
        אליך קודם, ושום דבר לא יוצא לפני שתאשר.
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

      {waiting.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--hair)', paddingTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '.86rem' }}>
            מחכות לאישור שלך ({waiting.length})
          </div>
          <p className="screen-note" style={{ margin: '0 0 8px' }}>
            עותק בדיקה נשלח אליך. תקרא אותו במייל, ואם הוא בסדר אשר כאן.
          </p>
          {waiting.map((p) => (
            <div key={key(p)} style={{ fontSize: '.82rem', padding: '3px 0' }}>
              {p.contact.full_name}
              <span style={{ color: 'var(--muted)' }}> · {p.job.company}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              type="button" style={btn} disabled={busy}
              onClick={() => act('approve', waiting.map((p) => p.queued!.id))}
            >
              אשר ושלח
            </button>
            <button
              type="button" style={quiet} disabled={busy}
              onClick={() => act('cancel', waiting.map((p) => p.queued!.id))}
            >
              בטל
            </button>
          </div>
        </div>
      )}

      {picks.some((p) => p.queued && p.queued.status !== 'test_sent') && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {picks
            .filter((p) => p.queued && p.queued.status !== 'test_sent')
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
