'use client';
import { useEffect, useState } from 'react';

type Person = {
  id: string; email: string | null; display_name: string | null;
  is_owner: boolean; created_at: string; searches: number;
};
type Invite = { code: string; email: string | null; created_at: string };

const day = (s: string) =>
  new Date(s).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

// Owner-only. It renders nothing at all for anyone else, because the endpoint
// behind it answers 403 — the block is absent rather than disabled, since a
// control you are told you may not use is just a worse way of saying no.
export default function People() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [pending, setPending] = useState<Invite[]>([]);
  const [mail, setMail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const res = await fetch('/api/invites').catch(() => null);
    if (!res?.ok) { setPeople([]); return; }
    const body = await res.json();
    setPeople(body.people ?? []);
    setPending(body.pending ?? []);
  }
  useEffect(() => { load(); }, []);

  if (people === null || people.length === 0) return null;

  async function invite(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true); setMsg('');
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail.trim() }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setMsg(body?.error ?? 'לא נשלח'); return; }
    setMail('');
    setMsg(`ההזמנה נרשמה. תגיד ל־${mail.trim()} להיכנס לכתובת של חדר המצב ולהתחבר עם המייל הזה.`);
    load();
  }

  async function remove(body: object, ask: string) {
    if (!confirm(ask)) return;
    setBusy(true);
    await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    load();
  }

  return (
    <section className="owner">
      <h2>ניהול משתמשים</h2>

      <form className="sform" onSubmit={invite}>
        <input
          type="email" value={mail} placeholder="המייל של מי שאתה מזמין"
          aria-label="מייל להזמנה"
          onChange={(e) => { setMail(e.target.value); setMsg(''); }}
        />
        <button disabled={busy || !mail.trim()}>הזמן</button>
      </form>
      <p className="prow-note">
        ההזמנה נצמדת לכתובת. מי שיגיע בלי הזמנה על שמו לא מקבל גישה, גם אם
        הצליח להזדהות.
      </p>
      {msg && <p className="sform-msg">{msg}</p>}

      {people.map((p) => (
        <article className="search" key={p.id}>
          <div className="head">
            <span className="label">{p.email}</span>
            <span className="spacer" />
            {p.is_owner
              ? <span className="chip must">בעלים</span>
              : <span className={`count${p.searches ? '' : ' zero'}`}>{p.searches}</span>}
          </div>
          <div className="foot">
            <span>
              {p.is_owner ? 'סריקה ידנית מותרת' : `${p.searches} חיפושים פעילים`}
              {' · '}הצטרף {day(p.created_at)}
            </span>
            <span className="spacer" />
            {!p.is_owner && (
              <button
                disabled={busy}
                onClick={() => remove(
                  { id: p.id },
                  `להסיר את ${p.email}? החיפושים, ההגשות והמנויים שלו יימחקו.`
                )}
              >
                הסר
              </button>
            )}
          </div>
        </article>
      ))}

      {pending.map((v) => (
        <article className="search off" key={v.code}>
          <div className="head">
            <span className="label">{v.email}</span>
            <span className="spacer" />
            <span className="chip">הוזמן</span>
          </div>
          <div className="foot">
            <span>נשלחה הזמנה {day(v.created_at)} · טרם נכנס</span>
            <span className="spacer" />
            <button
              disabled={busy}
              onClick={() => remove({ code: v.code }, `לבטל את ההזמנה ל־${v.email}?`)}
            >
              בטל הזמנה
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
