'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { expand, QUERY_TERMS } from '@/lib/expand';

// Nothing is saved before the person has seen what their words turned into.
// An expansion that missed is obvious here in a second, and invisible for a
// week if the only evidence is a feed that feels slightly wrong.
export default function SearchForm() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const e = expand(text);
  const ask = e.terms.slice(0, QUERY_TERMS);

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true); setMsg('');
    const res = await fetch('/api/searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: text.trim() }),
    }).catch(() => null);

    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setMsg(body?.error ?? 'לא נשמר');
      setBusy(false);
      return;
    }
    setText('');
    setBusy(false);
    // The count is the whole answer to "did that work" — say it before the
    // list re-renders, because on a fresh search the feed is where the jobs
    // are and this screen will look no different than it did a moment ago.
    setMsg(
      body.matched > 0
        ? `נשמר · ${body.matched} משרות שכבר במאגר תואמות — הן במסך משרות`
        : 'נשמר · אין עדיין משרות תואמות במאגר. הסריקה הבאה תחפש אותן.'
    );
    router.refresh();
  }

  return (
    <>
      <form className="sform" onSubmit={save}>
        <input
          type="text" value={text} maxLength={80}
          placeholder="איזה תפקיד לחפש?" aria-label="איזה תפקיד לחפש"
          onChange={(ev) => { setText(ev.target.value); setMsg(''); }}
        />
        <button disabled={busy || !text.trim()}>{busy ? 'רגע…' : 'הוסף'}</button>
      </form>

      {msg && <p className="sform-msg">{msg}</p>}

      {text.trim() && (
        <div className="preview">
          {!e.confident && (
            <p className="warnbox">
              לא זיהיתי את התחום. אחפש את המילים עצמן — זה עובד פחות טוב.
            </p>
          )}

          <div className="prow">
            <div className="k">שואלים</div>
            <div className="v">
              <div className="chips">
                {ask.map((t) => <span key={t} className="chip ask">{t}</span>)}
              </div>
              <p className="note">{ask.length} מונחים שיישלחו לאתרי הדרושים בכל סריקה.</p>
            </div>
          </div>

          <div className="prow">
            <div className="k">מזהים לפי</div>
            <div className="v">
              <div className="chips">
                {e.match.map((t) => <span key={t} className="chip">{t}</span>)}
              </div>
            </div>
          </div>

          {e.must.length > 0 && (
            <div className="prow">
              <div className="k">חייב להכיל</div>
              <div className="v">
                <div className="chips">
                  {e.must.map((t) => <span key={t} className="chip must">{t}</span>)}
                </div>
                <p className="note">ציינת טכנולוגיה — משרה שלא מזכירה אותה לא תיכנס.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
