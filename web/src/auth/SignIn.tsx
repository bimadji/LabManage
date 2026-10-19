import { useState, type FormEvent } from 'react';
import { supabaseClient } from '../lib/supabase';

/** Minimal email/password gate so every page has a bearer token to send. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const { error: signInError } = await supabaseClient().auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signInError) setError('Email atau kata sandi salah.');
  }

  return (
    <main className="auth">
      <h1>LabManage</h1>
      <p className="muted">Masuk dengan akun Tim Robotik.</p>
      <form onSubmit={onSubmit} className="card form">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="password">Kata sandi</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
