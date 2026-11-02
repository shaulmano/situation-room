'use client';
import { useEffect, useState } from 'react';

// ספריית קורות החיים: הגרסאות שמשמשות כרפרנס, בטקסט.
//
// למה טקסט ולא קובץ: הטבלה הזאת כבר מזינה את הניקוד (score.py קורא ממנה
// content), וטקסט הוא גם מה שאפשר להעתיק לקלוד כבסיס לגרסה מכוונת למשרה.
// קובץ PDF אפשר רק להוריד. את הקובץ עצמו שמודבק להודעות בלינקדאין ממשיכים
// להחזיק ב-Storage, והשדה filename מצביע אליו.
const btn: React.CSSProperties = {
  // width מפורש: globals.css נותן ל-button רוחב מלא בשביל טופס הכניסה, וכאן
  // זה מתח את "ערוך" על כל השורה והרחיק אותו מהשם שהוא שייך לו.
  width: 'auto',
  fontSize: '.78rem',
  fontWeight: 700,
  color: 'var(--accent)',
  background: 'transparent',
  border: '1px solid var(--accent)',
  borderRadius: 6,
  padding: '.3em .7em',
  cursor: 'pointer',
};

const area: React.CSSProperties = {
  width: '100%',
  minHeight: 150,
  fontSize: '.78rem',
  lineHeight: 1.5,
  padding: '.5em .6em',
  border: '1px solid var(--hair)',
  borderRadius: 6,
  resize: 'vertical',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const field: React.CSSProperties = {
  fontSize: '.8rem',
  padding: '.4em .6em',
  border: '1px solid var(--hair)',
  borderRadius: 6,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

type Cv = {
  id: string;
  label: string | null;
  filename: string | null;
  content: string | null;
  updated_at: string | null;
};

export default function CvLibrary() {
  const [cvs, setCvs] = useState<Cv[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/cvs').catch(() => null);
    if (res?.ok) setCvs(((await res.json()).cvs as Cv[]) ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function save(id: string, label: string, content: string) {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/cvs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, label, content }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setMsg((res && (await res.json()).error) || 'השמירה נכשלה');
      return;
    }
    setMsg('נשמר');
    setOpenId(null);
    setAdding(false);
    setNewId('');
    setNewLabel('');
    setDraft('');
    void load();
  }

  return (
    <div>
      <p className="screen-note" style={{ marginTop: 0 }}>
        הגרסאות שמשמשות כרפרנס. הן גם מה שהניקוד משווה מולו, ולכן תוכן מעודכן
        כאן משפר גם את ההתאמות.
      </p>

      {cvs.map((cv) => (
        <div key={cv.id} style={{ borderTop: '1px solid var(--hair)', padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: '.86rem' }}>{cv.label || cv.id}</b>
            <span className="chip mute">{cv.id}</span>
            <span style={{ fontSize: '.74rem', color: 'var(--muted)' }}>
              {cv.content ? `${cv.content.length.toLocaleString()} תווים` : 'ריק'}
            </span>
            <button
              type="button"
              style={{ ...btn, marginInlineStart: 'auto' }}
              onClick={() => {
                setOpenId(openId === cv.id ? null : cv.id);
                setDraft(cv.content || '');
                setMsg('');
              }}
            >
              {openId === cv.id ? 'סגור' : 'ערוך'}
            </button>
          </div>

          {openId === cv.id && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea style={area} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div>
                <button
                  type="button"
                  style={btn}
                  disabled={busy}
                  onClick={() => save(cv.id, cv.label || cv.id, draft)}
                >
                  {busy ? 'שומר…' : 'שמור'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div style={{ borderTop: '1px solid var(--hair)', paddingTop: 10, marginTop: 4 }}>
        {!adding ? (
          <button type="button" style={btn} onClick={() => { setAdding(true); setMsg(''); }}>
            הוסף גרסה
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              style={field}
              placeholder="מזהה באנגלית, למשל rnd"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
            <input
              style={field}
              placeholder="שם לתצוגה, למשל R&D Program Manager"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <textarea
              style={area}
              placeholder="הדבק כאן את קורות החיים המלאים"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                style={btn}
                disabled={busy}
                onClick={() => save(newId, newLabel, draft)}
              >
                {busy ? 'שומר…' : 'שמור גרסה חדשה'}
              </button>
              <button
                type="button"
                style={{ ...btn, borderColor: 'var(--hair)', color: 'var(--muted)' }}
                onClick={() => { setAdding(false); setDraft(''); }}
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <p style={{ marginTop: 8 }}>
          <span className={msg === 'נשמר' ? 'chip ok' : 'chip crit'}>{msg}</span>
        </p>
      )}
    </div>
  );
}
