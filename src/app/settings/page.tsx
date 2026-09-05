'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';
import PushToggle from '@/components/PushToggle';
import People from '@/components/People';

export default function Settings() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    browserClient().auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '');
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { setMsg('שתי הסיסמאות לא זהות.'); return; }
    setBusy(true); setMsg('');
    const { error } = await browserClient().auth.updateUser({ password: pw });
    if (error) setMsg(error.message);
    else { setOk(true); setPw(''); setPw2(''); }
    setBusy(false);
  }

  async function signOut() {
    await browserClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <h2>הגדרות</h2>

      <div className="rows">
        <div className="row"><span className="grow">מחובר כ־<span className="sub">{email || '…'}</span></span></div>
      </div>

      <h2>התראות</h2>
      <PushToggle />

      <h2>סיסמה</h2>
      {ok ? (
        <div className="empty"><b>הסיסמה נקבעה</b>מהפעם הבאה אפשר להיכנס בלי קישור למייל.</div>
      ) : (
        <form onSubmit={save} style={{ maxWidth: 380 }}>
          <p style={{ color: 'var(--muted)', fontSize: '.88rem' }}>
            קבע סיסמה פעם אחת, ומכאן הכניסה נשמרת בדפדפן בלי סבב מייל.
          </p>
          <input type="password" required minLength={8} placeholder="סיסמה חדשה"
                 autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <input type="password" required minLength={8} placeholder="שוב, לאימות"
                 autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <button disabled={busy}>{busy ? 'שומר…' : 'קבע סיסמה'}</button>
          {msg && <p style={{ color: 'var(--crit)', marginTop: 10 }}>{msg}</p>}
        </form>
      )}

      <h2>חשבון</h2>
      <button type="button" className="link-btn" onClick={signOut}>התנתקות</button>

      <People />
    </>
  );
}
