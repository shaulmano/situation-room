'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';

type Mode = 'password' | 'link';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  // First run has no account yet, so a failed sign-in falls through to sign-up.
  // Only the owner's address survives the middleware, so this cannot open the app up.
  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const sb = browserClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) { router.push('/'); router.refresh(); return; }

    if (error.message.toLowerCase().includes('invalid login credentials')) {
      const { error: signUpError } = await sb.auth.signUp({ email, password });
      if (!signUpError) { router.push('/'); router.refresh(); return; }
      setMsg(signUpError.message);
    } else {
      setMsg(error.message);
    }
    setBusy(false);
  }

  async function withLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setMsg(error.message); else setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="login">
        <h1>חדר המצב</h1>
        <p>נשלח קישור כניסה ל־{email}. פתח אותו מהמכשיר הזה.</p>
      </div>
    );
  }

  return (
    <div className="login">
      <h1>חדר המצב</h1>
      <p>
        {mode === 'password'
          ? 'הכניסה נשמרת במכשיר. בפעם הראשונה הסיסמה שתקליד היא זו שנקבעת.'
          : 'קישור חד־פעמי למייל.'}
      </p>

      <form onSubmit={mode === 'password' ? withPassword : withLink}>
        <input
          type="email" required placeholder="you@example.com" autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        {mode === 'password' && (
          <input
            type="password" required minLength={8} placeholder="סיסמה"
            autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <button disabled={busy}>
          {busy ? 'רגע…' : mode === 'password' ? 'כניסה' : 'שלח קישור כניסה'}
        </button>
      </form>

      <button
        type="button" className="link-btn"
        onClick={() => { setMode(mode === 'password' ? 'link' : 'password'); setMsg(''); }}
      >
        {mode === 'password' ? 'לא זוכר סיסמה? כניסה בקישור למייל' : 'כניסה עם סיסמה'}
      </button>

      {msg && <p style={{ color: 'var(--crit)', marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
