'use client';
import { useEffect, useState } from 'react';

// הקבצים שיש לשאול במחשב ובטלפון. הראשון הוא ברירת המחדל לכל משרה,
// ושאול בוחר אחר לפי משרה (24.11.2026: "leave it for me to choose on every job").
const FILES = [
  'Shaul_Mano.pdf',
  'Shaul_Mano_QA_Manager.pdf',
  'Shaul_Mano_Project_Manager.pdf',
  'Shaul_Mano_Project_Release_Manager.pdf',
  'Shaul_Mano_Release_Manager.pdf',
];

// העתקת הודעה גנרית למשרה (בלי שם נמען), עם קישור למשרה, ובחירת הקובץ לצירוף.
export default function CopyGeneric({ text, file, jobId }: { text: string; file: string; jobId?: string }) {
  const [ok, setOk] = useState(false);
  const [pick, setPick] = useState(file);
  const key = jobId ? 'cvpick:' + jobId : '';
  useEffect(() => {
    try {
      const v = key ? localStorage.getItem(key) : null;
      if (v && FILES.includes(v)) setPick(v);
    } catch {}
  }, [key]);
  function choose(v: string) {
    setPick(v);
    try { if (key) localStorage.setItem(key, v); } catch {}
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch {
      alert('לא הצלחתי להעתיק. סמן את הטקסט ידנית.');
    }
  }
  const options = FILES.includes(pick) ? FILES : [pick, ...FILES];
  return (
    <>
      <button type="button" className={'mark' + (ok ? ' on' : '')} onClick={copy}
        title={'ההודעה מועתקת עם קישור למשרה. לצרף: ' + pick}>
        {ok ? '✓ הועתק' : 'העתק הודעה'}
      </button>
      <label className="mark" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        לצרף:
        <select value={pick} onChange={(e) => choose(e.target.value)}
          style={{ font: 'inherit', background: 'transparent', border: 0, color: 'inherit' }}>
          {options.map((f) => <option key={f} value={f}>{f.replace('Shaul_Mano', 'Shaul Mano').replace(/_/g, ' ').replace('.pdf', '')}</option>)}
        </select>
      </label>
    </>
  );
}
