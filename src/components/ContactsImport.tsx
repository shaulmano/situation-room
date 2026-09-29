'use client';
import { useEffect, useRef, useState } from 'react';

// LinkedIn hands the export back as a zip, and on a phone unzipping it first is
// three steps in a file manager. So the zip is read here: find Connections.csv
// in the central directory and inflate that one entry. No library, this is
// forty lines against a 90KB dependency, and the browser already has the
// inflater.
async function csvFromZip(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // End of central directory, scanned backwards: the comment at the end has no
  // fixed length, so the signature is the only way in.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('הקובץ אינו zip תקין');

  const entries = dv.getUint16(eocd + 10, true);
  let ptr = dv.getUint32(eocd + 16, true);

  for (let n = 0; n < entries; n++) {
    if (dv.getUint32(ptr, true) !== 0x02014b50) break;
    const method = dv.getUint16(ptr + 10, true);
    const compressed = dv.getUint32(ptr + 20, true);
    const nameLen = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const commentLen = dv.getUint16(ptr + 32, true);
    const local = dv.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(buf.subarray(ptr + 46, ptr + 46 + nameLen));

    if (/connections\.csv$/i.test(name)) {
      // Sizes come from the central directory, never from the local header:
      // the local one is allowed to carry zeros and defer to a data descriptor.
      const lNameLen = dv.getUint16(local + 26, true);
      const lExtraLen = dv.getUint16(local + 28, true);
      const start = local + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compressed);
      if (method === 0) return new TextDecoder().decode(data);

      const DS = (globalThis as unknown as { DecompressionStream?: new (f: string) => unknown })
        .DecompressionStream;
      if (!DS) throw new Error('הדפדפן לא יודע לפתוח zip. חלץ את Connections.csv והעלה אותו.');
      const stream = new Blob([data]).stream().pipeThrough(new DS('deflate-raw') as ReadableWritablePair);
      return await new Response(stream).text();
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('לא נמצא Connections.csv בתוך ה-zip');
}

const DAY = 864e5;

export default function ContactsImport() {
  const input = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState<number | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const res = await fetch('/api/contacts', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return;
    const body = await res.json();
    setCount(body.count ?? 0);
    setLast(body.last ?? null);
  }

  useEffect(() => { load(); }, []);

  async function upload(file: File) {
    setBusy(true); setErr(''); setMsg('');
    try {
      const csv = /\.zip$/i.test(file.name) ? await csvFromZip(file) : await file.text();
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setErr(body.error ?? 'הייבוא נכשל');
      else {
        setMsg(`נקלטו ${body.saved} אנשי קשר, ${body.withEmail} מהם עם מייל.`);
        load();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'הקובץ לא נקרא');
    }
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / DAY) : null;

  return (
    <>
      <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginTop: 0 }}>
        בלינקדאין: Settings ← Data Privacy ← Get a copy of your data ← Connections.
        הקובץ מגיע למייל תוך עשר דקות עד יממה. אפשר להעלות אותו כאן כמו שהוא, zip או csv.
        אנשי הקשר מתמזגים, וטלפונים שהוספת לא נמחקים.
      </p>

      <div className="rows">
        <div className="row">
          <span className="grow">
            אנשי קשר במאגר
            <span className="sub">
              {count === null
                ? '…'
                : count === 0
                  ? 'עדיין לא הועלה ייצוא'
                  : days === null
                    ? `${count}`
                    : `${count} · עודכן לפני ${days} ימים`}
            </span>
          </span>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept=".csv,.zip,text/csv,application/zip"
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        style={{ marginTop: 12, fontSize: '.85rem' }}
      />

      {busy && <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>קולט…</p>}
      {msg && <p style={{ color: 'var(--good)', fontSize: '.85rem' }}>{msg}</p>}
      {err && <p style={{ color: 'var(--crit)', fontSize: '.85rem' }}>{err}</p>}
    </>
  );
}
