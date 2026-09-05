'use client';
import { useEffect, useState } from 'react';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = 'checking' | 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied';

export default function PushToggle() {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        // iOS Safari hides PushManager entirely until the page is installed to
        // the Home Screen, so on an iPhone this is the "not added yet" case.
        const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        setState(iOS ? 'needs-install' : 'unsupported');
        return;
      }
      if (Notification.permission === 'denied') { setState('denied'); return; }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })();
  }, []);

  async function enable() {
    setBusy(true); setMsg('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState('denied'); return; }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });

      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), label: navigator.userAgent.slice(0, 60) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'שמירה נכשלה');
      setState('on');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'ההפעלה נכשלה');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true); setMsg('');
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => null);
      await sub.unsubscribe();
    }
    setState('off');
    setBusy(false);
  }

  if (state === 'checking') return <p className="screen-note">בודק…</p>;

  if (state === 'needs-install') {
    return (
      <div className="empty">
        <b>קודם הוסף למסך הבית</b>
        אפל מרשה התראות רק לאתר שהותקן. בספארי: כפתור השיתוף ← הוסף למסך הבית ←
        פתח משם ← וחזור לכאן.
      </div>
    );
  }

  if (state === 'unsupported') {
    return <p className="screen-note">הדפדפן הזה לא תומך בהתראות דחיפה.</p>;
  }

  if (state === 'denied') {
    return (
      <div className="empty">
        <b>ההתראות חסומות</b>
        הרשאה נדחתה. הגדרות ← התראות ← חדר המצב, ואז חזור לכאן.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={state === 'on' ? 'link-btn' : 'scanbtn'}
        onClick={state === 'on' ? disable : enable}
        disabled={busy}
      >
        {busy ? 'רגע…' : state === 'on' ? 'כבה התראות במכשיר הזה' : 'הפעל התראות'}
      </button>
      <p className="screen-note">
        {state === 'on'
          ? 'מקבל התראה על כל משרה חדשה על המטרה. ההרשמה היא פר-מכשיר.'
          : 'התראה על כל משרה חדשה, גם כשהאפליקציה סגורה.'}
      </p>
      {msg && <p className="screen-note" style={{ color: 'var(--crit)' }}>{msg}</p>}
    </>
  );
}
