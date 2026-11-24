'use client';
import { useState } from 'react';

// העתקת הערה קצרה לבקשת חברות (עד 200 תווים, המגבלה בלינקדאין בחשבון חינמי).
export default function CopyNote({ text }: { text: string }) {
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
    <button type="button" className={'apply indirect' + (ok ? ' on' : '')} onClick={copy}
      title={text}>
      {ok ? '✓ הועתק' : 'העתק הערה לבקשה'}
    </button>
  );
}
