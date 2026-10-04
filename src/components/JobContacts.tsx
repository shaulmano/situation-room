'use client';
import { useState } from 'react';
import { mutualsHref, type WarmContact } from '@/lib/contacts';
import { referralMessage } from '@/lib/outreach';

// The block that sits under a job row when Shaul already knows someone at that
// company. Collapsed by default: on a day with forty jobs, four of them warm,
// an open block on each would bury the rest of the feed.
//
// Styling is inline on purpose. Everything here is three colours and a border
// straight out of globals.css, and a dozen new class names in a stylesheet
// nobody opens is a worse trade than a few style props.
const line: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  padding: '6px 0',
  borderTop: '1px solid var(--hair)',
};

const link: React.CSSProperties = {
  fontSize: '.76rem',
  fontWeight: 700,
  textDecoration: 'none',
  color: 'var(--accent)',
  border: '1px solid var(--accent)',
  borderRadius: 6,
  padding: '.22em .6em',
  whiteSpace: 'nowrap',
};

const button: React.CSSProperties = { ...link, background: 'transparent', cursor: 'pointer', width: 'auto' };

export type JobRef = { company: string; title: string; cvId?: string | null };

// The three CVs, in the same ids the matcher uses.
const CVS: [string, string][] = [
  ['qa', 'QA'],
  ['program', 'תוכניות'],
  ['delivery', 'Delivery'],
];

export default function JobContacts({ contacts, job }: { contacts: WarmContact[]; job: JobRef }) {
  const [rows, setRows] = useState(contacts);
  if (rows.length === 0) return null;

  function patch(id: string, fields: Partial<WarmContact>) {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }

  return (
    <details
      style={{
        flex: '1 1 100%',
        marginTop: 8,
        background: 'var(--raised)',
        border: '1px solid var(--hair)',
        borderRadius: 6,
        padding: '8px 10px',
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: '.8rem', fontWeight: 700, color: 'var(--good)' }}>
        אתה מכיר שם {rows.length} {rows.length === 1 ? 'איש קשר' : 'אנשי קשר'}
      </summary>

      {rows.map((c) => (
        <Contact key={c.id} contact={c} job={job} onPatch={(f) => patch(c.id, f)} />
      ))}
    </details>
  );
}

function Contact({
  contact,
  job,
  onPatch,
}: {
  contact: WarmContact;
  job: JobRef;
  onPatch: (fields: Partial<WarmContact>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [draft, setDraft] = useState<string | null>(null);
  // Which CV the message points at. It starts at the family the matcher picked,
  // but that pick is wrong often enough to matter: a Principal Product Manager
  // posting came through as delivery. Getting it wrong here is not a chip on a
  // row, it is the wrong file in a message to someone doing Shaul a favour.
  const [cv, setCv] = useState<string>(job.cvId ?? 'qa');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutuals = mutualsHref(contact.linkedin_url);

  const askedDays = contact.contacted_at
    ? Math.floor((Date.now() - new Date(contact.contacted_at).getTime()) / 864e5)
    : null;

  async function save(fields: Record<string, unknown>, applied: Partial<WarmContact>) {
    setBusy(true);
    const res = await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, ...fields }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) onPatch(applied);
    return !!res?.ok;
  }

  // The message is built once, when the panel opens, and then left alone. It is
  // a draft in a textarea, not generated text on a leash: editing it before
  // copying is the normal case, not an exception.
  function compose(cvId: string): string {
    return referralMessage({
      contactName: contact.full_name,
      company: job.company,
      jobTitle: job.title,
      cvId,
    });
  }

  function openDraft() {
    setDraft(compose(cv));
  }

  async function copy() {
    if (draft === null) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div style={line}>
      <span style={{ flex: '1 1 140px', minWidth: 0, fontSize: '.82rem', fontWeight: 600 }}>
        {contact.full_name}
        {contact.title && (
          <span style={{ display: 'block', color: 'var(--muted)', fontSize: '.72rem', fontWeight: 400 }}>
            {contact.title}
          </span>
        )}
        {askedDays !== null && (
          <span style={{ display: 'block', color: 'var(--good)', fontSize: '.72rem', fontWeight: 600 }}>
            {askedDays === 0 ? 'פנית היום' : `פנית לפני ${askedDays} ימים`}
          </span>
        )}
      </span>

      <button type="button" style={button} onClick={() => (draft === null ? openDraft() : setDraft(null))}>
        {draft === null ? 'פנייה' : 'סגור'}
      </button>
      {contact.email && <a style={link} href={`mailto:${contact.email}`}>מייל</a>}
      {contact.phone && (
        <a style={link} href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} dir="ltr">
          {contact.phone}
        </a>
      )}
      {contact.linkedin_url && (
        <a style={link} href={contact.linkedin_url} target="_blank" rel="noreferrer">פרופיל</a>
      )}
      {mutuals && (
        <a style={link} href={mutuals} target="_blank" rel="noreferrer" title="לינקדאין מציג מי מהקשרים שלו מוכר גם לך">
          מי עוד מכיר
        </a>
      )}

      {!contact.phone && !editing && (
        <button type="button" style={button} onClick={() => setEditing(true)}>הוסף טלפון</button>
      )}

      {editing && (
        <span style={{ display: 'flex', gap: 6, flex: '1 1 160px' }}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="052-0000000"
            dir="ltr"
            style={{
              flex: 1,
              minWidth: 0,
              font: 'inherit',
              fontSize: '.8rem',
              padding: '.25em .5em',
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: 6,
            }}
          />
          <button
            type="button"
            style={button}
            disabled={busy}
            onClick={async () => {
              const ok = await save({ phone }, { phone: phone.trim() || null });
              if (ok) setEditing(false);
            }}
          >
            {busy ? '…' : 'שמור'}
          </button>
        </span>
      )}

      {draft !== null && (
        <div style={{ flex: '1 1 100%', marginTop: 6 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            style={{
              width: '100%',
              font: 'inherit',
              fontSize: '.8rem',
              lineHeight: 1.5,
              padding: '.5em .6em',
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>קורות חיים:</span>
            {CVS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setCv(id); setDraft(compose(id)); }}
                style={{
                  ...button,
                  opacity: cv === id ? 1 : 0.5,
                  borderStyle: cv === id ? 'solid' : 'dashed',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            <button type="button" style={button} onClick={copy}>
              {copied ? 'הועתק' : 'העתק'}
            </button>
            {contact.linkedin_url && (
              <a style={link} href={contact.linkedin_url} target="_blank" rel="noreferrer">
                פתח שיחה בלינקדאין
              </a>
            )}
            <button
              type="button"
              style={button}
              disabled={busy}
              onClick={async () => {
                const ok = await save({ contacted: true }, { contacted_at: new Date().toISOString() });
                if (ok) setDraft(null);
              }}
            >
              {busy ? '…' : 'סמן שפניתי'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
