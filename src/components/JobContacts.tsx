'use client';
import { useState } from 'react';
import { mutualsHref, type WarmContact } from '@/lib/contacts';

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

export default function JobContacts({ contacts }: { contacts: WarmContact[] }) {
  const [rows, setRows] = useState(contacts);
  if (rows.length === 0) return null;

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
        <Contact
          key={c.id}
          contact={c}
          onPhone={(phone) =>
            setRows((prev) => prev.map((p) => (p.id === c.id ? { ...p, phone } : p)))
          }
        />
      ))}
    </details>
  );
}

function Contact({
  contact,
  onPhone,
}: {
  contact: WarmContact;
  onPhone: (phone: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(contact.phone ?? '');
  const [busy, setBusy] = useState(false);
  const mutuals = mutualsHref(contact.linkedin_url);

  async function save() {
    setBusy(true);
    const res = await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, phone: value }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      onPhone(value.trim() || null);
      setEditing(false);
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
      </span>

      {contact.email && (
        <a style={link} href={`mailto:${contact.email}`}>מייל</a>
      )}
      {contact.phone && (
        <a style={link} href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} dir="ltr">
          {contact.phone}
        </a>
      )}
      {contact.linkedin_url && (
        <a style={link} href={contact.linkedin_url} target="_blank" rel="noreferrer">פרופיל</a>
      )}
      {mutuals && (
        <a
          style={link}
          href={mutuals}
          target="_blank"
          rel="noreferrer"
          title="לינקדאין מציג מי מהקשרים שלו מוכר גם לך"
        >
          מי עוד מכיר
        </a>
      )}

      {!contact.phone && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{ ...link, background: 'transparent', cursor: 'pointer', width: 'auto' }}
        >
          הוסף טלפון
        </button>
      )}

      {editing && (
        <span style={{ display: 'flex', gap: 6, flex: '1 1 160px' }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
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
            onClick={save}
            disabled={busy}
            style={{ ...link, background: 'transparent', cursor: 'pointer', width: 'auto' }}
          >
            {busy ? '…' : 'שמור'}
          </button>
        </span>
      )}
    </div>
  );
}
