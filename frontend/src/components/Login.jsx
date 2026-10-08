import React, { useEffect, useState } from 'react';
import { getDemoCreds, login, signup } from '../api';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);

  useEffect(() => {
    getDemoCreds().then(setDemo).catch(() => {});
  }, []);

  function fillDemo() {
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setMode('login');
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = mode === 'login'
        ? await login(email.trim(), password)
        : await signup(email.trim(), password, name.trim());
      onAuth(data.user);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-badge">Recruiter screening · NLP-powered</div>
        <h1>Resume Screener</h1>
        <p className="auth-sub">
          {mode === 'login' ? 'Welcome back. Sign in to your recruiter workspace.'
            : 'Create your recruiter account to start screening.'}
        </p>

        {demo && (
          <button type="button" className="demo-box" onClick={fillDemo} title="Fill in the demo credentials">
            <span className="demo-label">DEMO ACCOUNT — click to fill</span>
            <span className="demo-creds">{demo.email} · {demo.password}</span>
            <span className="demo-note">Demo auth for trying the product — not for real accounts.</span>
          </button>
        )}

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label>
              <span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Sharma" autoComplete="name" />
            </label>
          )}
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com" autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>New here? <button type="button" onClick={() => { setMode('signup'); setError(''); }}>Create an account</button></>
          ) : (
            <>Have an account? <button type="button" onClick={() => { setMode('login'); setError(''); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
