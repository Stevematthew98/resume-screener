import Button from './Button';
import React, { useEffect, useState } from 'react';
import { getDemoCreds, login, signup } from '../api';

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h6" />
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

  const steps = [
    {
      title: 'Upload resumes, describe the role',
      text: 'Drop in PDF or DOCX resumes and paste the job description with required and preferred skills.',
    },
    {
      title: 'Watch the 8-stage NLP pipeline',
      text: 'Text extraction, skill detection, semantic matching and scoring run live for every resume.',
    },
    {
      title: 'Get rankings you can explain',
      text: 'Each score breaks into skills, job-description similarity, experience and education — with the evidence shown.',
    },
  ];

  return (
    <div className="auth-split">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-logo">
            <span className="auth-logo-mark"><LogoMark /></span>
            Resume Screener
          </div>
          <p className="auth-eyebrow">NLP-Powered Recruitment Intelligence</p>
          <h1>Hire with evidence, not gut feel.</h1>
          <p className="auth-sub">
            Resume Screener reads batches of resumes, matches them against your
            job description with NLP, and ranks candidates with transparent
            scores — so every shortlist decision is backed by evidence you can
            inspect.
          </p>
          <ol className="auth-how">
            {steps.map((s, i) => (
              <li className="auth-step" key={s.title}>
                <span className="auth-step-num">{i + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="auth-formula" aria-label="How the match score is weighted">
            <span>Skills 50%</span>
            <span>JD similarity 25%</span>
            <span>Experience 15%</span>
            <span>Education 10%</span>
          </div>
          <p className="auth-fair">Rankings assist your decision — no candidate is ever auto-rejected.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form">
          <div className="auth-brand-mobile">
            <div className="auth-logo">
              <span className="auth-logo-mark"><LogoMark /></span>
              Resume Screener
            </div>
            <h1>Hire with evidence, not gut feel.</h1>
            <p className="auth-sub">NLP resume screening with explainable, evidence-backed candidate rankings.</p>
          </div>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-sub">
            {mode === 'login' ? 'Sign in to your recruiter workspace.'
              : 'Create your recruiter account to start screening.'}
          </p>

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <label className="field">
                <span className="field-label">Your name</span>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Sharma" autoComplete="name" />
              </label>
            )}
            <label className="field">
              <span className="field-label">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" autoComplete="email" required />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <Button type="submit" className="btn-primary btn-block" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {demo && (
            <Button type="button" className="demo-strip" onClick={fillDemo} title="Fill in the demo credentials">
              <span className="demo-strip-label">Demo account</span>
              <span className="demo-creds">{demo.email} · {demo.password}</span>
              <span className="demo-go">Fill →</span>
            </Button>
          )}

          <div className="auth-switch">
            {mode === 'login' ? (
              <>New here? <Button type="button" className="link-btn" onClick={() => { setMode('signup'); setError(''); }}>Create an account</Button></>
            ) : (
              <>Have an account? <Button type="button" className="link-btn" onClick={() => { setMode('login'); setError(''); }}>Sign in</Button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
