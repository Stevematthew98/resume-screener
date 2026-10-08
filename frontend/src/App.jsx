import React, { useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const STEP_TITLES = {
  step1_ingest: '1 · Ingest',
  step2_extraction: '2 · Text extraction',
  step3_preprocessing: '3 · Preprocessing & skill extraction',
  step4_vectors: '4 · Vector representations',
  step5_matching: '5 · Matching & scoring',
  step6_transparency: '6 · Transparency',
  step8_feedback: '8 · Feedback hook',
};

const BAND_CLASS = {
  'Strong match': 'band-strong',
  'Worth reviewing': 'band-review',
  'Weak match': 'band-weak',
};

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button className="collapsible-head" onClick={() => setOpen(!open)} type="button">
        <span>{title}</span>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function Kv({ label, value }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{String(value)}</span>
    </div>
  );
}

function ScoreBars({ breakdown }) {
  const entries = Object.entries(breakdown || {});
  return (
    <div className="bars">
      {entries.map(([k, v]) => (
        <div className="bar-row" key={k}>
          <span className="bar-name">{k}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%` }} />
          </div>
          <span className="bar-val">{Number(v).toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

function ChipList({ items, tone }) {
  if (!items || items.length === 0) return <span className="muted">None detected</span>;
  return (
    <div className="chips">
      {items.map((s) => (
        <span key={s} className={`chip chip-${tone}`}>{s}</span>
      ))}
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState('');
  const [minExp, setMinExp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [feedbackState, setFeedbackState] = useState('');

  async function onAnalyze(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setFeedbackState('');
    if (!file) { setError('Please choose a resume file (PDF or DOCX).'); return; }
    if (!jd.trim()) { setError('Please paste a job description.'); return; }
    const form = new FormData();
    form.append('resume', file);
    form.append('job_description', jd);
    form.append('min_experience_years', minExp === '' ? '0' : String(Number(minExp) || 0));
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(verdict) {
    if (!result) return;
    setFeedbackState('sending');
    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis_id: result.analysis_id, verdict }),
      });
      if (!res.ok) throw new Error('failed');
      setFeedbackState(verdict === 'good_fit' ? 'Recorded — thanks. Marked as a good fit.' : 'Recorded — thanks. Marked as not a fit.');
    } catch {
      setFeedbackState('Could not record feedback.');
    }
  }

  const r7 = result?.step7_result;
  const r5 = result?.step5_matching;
  const r6 = result?.step6_transparency;

  return (
    <div className="page">
      <header className="header">
        <h1>Resume Screener</h1>
        <p className="sub">Upload a resume and a job description — the NLP pipeline scores the fit and shows its work.</p>
      </header>

      <form className="card" onSubmit={onAnalyze}>
        <label className="field">
          <span>Resume file (PDF or DOCX)</span>
          <input type="file" accept=".pdf,.docx,.doc" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <label className="field">
          <span>Job description</span>
          <textarea rows={7} value={jd} onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description here — role, required skills, experience…" />
        </label>
        <label className="field field-inline">
          <span>Minimum experience (years, optional)</span>
          <input type="number" min="0" step="0.5" value={minExp} onChange={(e) => setMinExp(e.target.value)} placeholder="0" />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Analyzing…' : 'Analyze fit'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      {result && r7 && (
        <div className="results">
          <div className={`band-card ${BAND_CLASS[r7.band] || ''}`}>
            <div className="band-left">
              <div className="band-name">{r7.band}</div>
              <div className="band-note">Assessment, not a guarantee of job performance.</div>
            </div>
            <div className="band-score">{r7.score.toFixed(3)}</div>
          </div>

          {!r7.meets_experience_requirement && (
            <div className="notice">
              Does not meet the minimum experience requirement ({r5.hard_filter.min_experience_years}y required, ~{r7.experience_years}y found).
            </div>
          )}

          <div className="card">
            <h2>Score breakdown</h2>
            <ScoreBars breakdown={r6.score_breakdown} />
            <p className="muted small">{r6.method}</p>
          </div>

          <div className="card">
            <h2>Skills</h2>
            <h3 className="mini">Matched ({r7.matched_skills.length})</h3>
            <ChipList items={r7.matched_skills} tone="green" />
            <h3 className="mini">Missing from resume ({r7.missing_skills.length})</h3>
            <ChipList items={r7.missing_skills} tone="amber" />
          </div>

          <div className="card">
            <h2>Extracted facts</h2>
            <Kv label="Experience" value={`~${r7.experience_years} years`} />
            <Kv label="Degrees" value={r7.degrees.length ? r7.degrees.join(', ') : '—'} />
            <Kv label="Job titles" value={r7.job_titles.length ? r7.job_titles.join(' · ') : '—'} />
            <Kv label="Skills detected" value={result.step3_preprocessing.skills_count} />
          </div>

          <div className="card">
            <h2>Pipeline steps</h2>
            {Object.entries(STEP_TITLES).map(([key, title]) => (
              <Collapsible key={key} title={title}>
                <pre className="json">{JSON.stringify(result[key], null, 2)}</pre>
              </Collapsible>
            ))}
          </div>

          <div className="card">
            <h2>Was this assessment useful?</h2>
            <div className="feedback-row">
              <button className="btn btn-ghost" type="button" onClick={() => sendFeedback('good_fit')} disabled={feedbackState === 'sending'}>Good fit</button>
              <button className="btn btn-ghost" type="button" onClick={() => sendFeedback('bad_fit')} disabled={feedbackState === 'sending'}>Bad fit</button>
            </div>
            {feedbackState && feedbackState !== 'sending' && <p className="muted">{feedbackState}</p>}
          </div>
        </div>
      )}

      <footer className="footer">
        <p className="muted small">
          Demo screener — scores are similarity assessments, not hiring decisions. Names and contact details are never used in scoring.
        </p>
      </footer>
    </div>
  );
}
