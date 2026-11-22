'use client';
import { useState } from 'react';

// העתקת הודעה גנרית למשרה (בלי שם נמען), עם קישור למשרה. הקובץ לצרף מופיע בהסבר הכפתור.
export default function CopyGeneric({ text, file }: { text: string; file: string }) {
  const [ok, setOk] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch {
      alert('לא הצלחתי להעתיק. סמן את הטקסט ידנית.');
    }
  }
  return (
    <button type="button" className={'mark' + (ok ? ' on' : '')} onClick={copy}
      title={'ההודעה מועתקת עם קישור למשרה. לצרף: ' + file}>
      {ok ? '✓ הועתק' : 'העתק הודעה'}
    </button>
  );
}
