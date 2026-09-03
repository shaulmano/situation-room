'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) { setState('error'); setMsg(error.message); }
    else setState('sent');
  }

  return (
    <div className="login">
      <h1>חדר המצב</h1>
      {state === 'sent' ? (
        <p>נשלח קישור כניסה ל־{email}. פתח אותו מהמכשיר הזה.</p>
      ) : (
        <>
          <p>הכניסה בקישור חד־פעמי למייל.</p>
          <form onSubmit={send}>
            <input
              type="email" required placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <button disabled={state === 'sending'}>
              {state === 'sending' ? 'שולח…' : 'שלח קישור כניסה'}
            </button>
          </form>
          {state === 'error' && <p style={{ color: 'var(--crit)', marginTop: 12 }}>{msg}</p>}
        </>
      )}
    </div>
  );
}
