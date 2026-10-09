import React, { useEffect, useState } from 'react';
import { getDemoCreds, login, signup } from '../api';

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
      <path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
    </svg>
  );
}

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

  const points = [
    { icon: <EyeIcon />, title: 'Watch the analysis happen', text: 'Every resume moves through a live, 8-stage NLP pipeline — nothing hidden.' },
    { icon: <ListIcon />, title: 'Ranked, explainable shortlists', text: 'Scores with the reasoning shown: matched skills, gaps, and what drove the number.' },
    { icon: <DocIcon />, title: 'You decide, always', text: 'Rankings assist — no candidate is ever rejected automatically.' },
  ];

  return (
    <div className="auth-split">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-logo">
            <span className="auth-logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h6" />
              </svg>
            </span>
            Resume Screener
          </div>
          <h1>Hire with evidence, not gut feel.</h1>
          <p className="lead">
            Screen whole batches of resumes against a role with NLP — and see exactly
            why each candidate ranks where they do.
          </p>
          <ul className="auth-points">
            {points.map((p) => (
              <li key={p.title}>
                <span className="auth-point-ico">{p.icon}</span>
                <div>
                  <strong>{p.title}</strong>
                  <span>{p.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="auth-form-side">
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="auth-sub">
          {mode === 'login' ? 'Sign in to your recruiter workspace.'
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
