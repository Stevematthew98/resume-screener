import React, { useEffect, useRef, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// Plain-language presentation of the 8 pipeline steps (no jargon in the UI)
const PLAIN_STEPS = [
  { key: 'step1_ingest', title: 'Getting your file ready', desc: 'We check your file type and size so it can be read safely.' },
  { key: 'step2_extraction', title: 'Reading your resume', desc: 'The text is pulled out of your PDF or Word file and sorted into sections like experience, skills and education.' },
  { key: 'step3_preprocessing', title: 'Finding your skills', desc: 'We identify the skills, years of experience, degrees and job titles mentioned in your resume.' },
  { key: 'step4_vectors', title: 'Understanding what it means', desc: 'Your resume and the job description are compared by meaning, not just keywords — so “ML” and “machine learning” count as the same thing.' },
  { key: 'step5_matching', title: 'Scoring the match', desc: 'Everything is combined into one score: how similar the content is, how many required skills you have, and whether the experience fits.' },
  { key: 'step6_transparency', title: 'Explaining the score', desc: 'The full breakdown is shown below. Names and contact details are never used in scoring.' },
  { key: 'step8_feedback', title: 'Learning from feedback', desc: 'Your “helpful / not helpful” vote is recorded so the system can keep improving.' },
];

const BAND_COPY = {
  'Strong match': { title: 'Looks like a strong match', note: 'Your skills and experience line up well with what this job asks for.' },
  'Worth reviewing': { title: 'Worth a closer look', note: 'There is real overlap, but also some gaps — the details below show exactly where.' },
  'Weak match': { title: 'Not a strong match', note: 'This role seems to ask for different skills or experience than what your resume shows.' },
};

const LOADING_LINES = [
  'Reading your resume…',
  'Finding your skills…',
  'Comparing with the job…',
  'Putting your results together…',
];

function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function ScoreRing({ score }) {
  const animated = useCountUp(score);
  const r = 54;
  const c = 2 * Math.PI * r;
  const color = score >= 0.65 ? '#059669' : score >= 0.4 ? '#d97706' : '#6b7280';
  return (
    <div className="ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c * (1 - animated)}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      <div className="ring-label">
        <span className="ring-num">{Math.round(animated * 100)}</span>
        <span className="ring-den">/ 100</span>
      </div>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button type="button" className="collapsible-head" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className={`chev ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function StepDots({ current }) {
  const steps = ['Upload resume', 'Job description', 'Your match'];
  return (
    <div className="stepdots">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'active' : 'todo';
        return (
          <React.Fragment key={label}>
            <div className={`stepdot ${state}`}>
              <span className="dot">{n < current ? '✓' : n}</span>
              <span className="dot-label">{label}</span>
            </div>
            {n < 3 && <div className={`dot-line ${n < current ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [jd, setJd] = useState('');
  const [minExp, setMinExp] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadLine, setLoadLine] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const fileInput = useRef(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setLoadLine((l) => (l + 1) % LOADING_LINES.length), 1600);
    return () => clearInterval(t);
  }, [loading]);

  const currentStep = result ? 3 : 1;

  function pickFile(f) {
    if (!f) return;
    const ok = /\.(pdf|docx?|doc)$/i.test(f.name);
    if (!ok) { setError('Please choose a PDF or Word file.'); return; }
    setError('');
    setFile(f);
  }

  async function onAnalyze(e) {
    e.preventDefault();
    setError('');
    setFeedbackMsg('');
    if (!file) { setError('Step 1: please upload your resume first.'); return; }
    if (!jd.trim()) { setError('Step 2: please paste the job description.'); return; }
    const form = new FormData();
    form.append('resume', file);
    form.append('job_description', jd);
    form.append('min_experience_years', minExp === '' ? '0' : String(Number(minExp) || 0));
    setLoading(true);
    setLoadLine(0);
    try {
      const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Something went wrong. Please try again.');
      }
      setResult(await res.json());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(helpful) {
    if (!result) return;
    setFeedbackMsg('Saving…');
    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis_id: result.analysis_id, verdict: helpful ? 'good_fit' : 'bad_fit' }),
      });
      if (!res.ok) throw new Error();
      setFeedbackMsg('Thanks — your feedback was recorded.');
    } catch {
      setFeedbackMsg('Could not save feedback. Please try again.');
    }
  }

  function reset() {
    setResult(null);
    setFile(null);
    setJd('');
    setMinExp('');
    setError('');
    setFeedbackMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const r7 = result?.step7_result;
  const band = r7 ? BAND_COPY[r7.band] || BAND_COPY['Worth reviewing'] : null;

  return (
    <div className="page">
      <header className="hero">
        <h1>Resume Screener</h1>
        <p>See how well your resume fits a job — in seconds, with the reasoning shown.</p>
      </header>

      <StepDots current={currentStep} />

      {error && <div className="alert">{error}</div>}

      {!result && !loading && (
        <form onSubmit={onAnalyze}>
          <section className="card">
            <div className="card-step">Step 1</div>
            <h2>Upload your resume</h2>
            <p className="hint">Choose a PDF or Word file. We only read the text — your file is never stored.</p>
            <div
              className={`dropzone ${dragOver ? 'over' : ''} ${file ? 'has-file' : ''}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
            >
              <input
                ref={fileInput} type="file" accept=".pdf,.docx,.doc" hidden
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {!file ? (
                <>
                  <div className="dz-icon">📄</div>
                  <div className="dz-text"><strong>Drop your resume here</strong> or click to browse</div>
                  <div className="dz-sub">PDF or Word, up to 10 MB</div>
                </>
              ) : (
                <div className="file-row">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(0)} KB</span>
                  <button type="button" className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); }}>✕</button>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-step">Step 2</div>
            <h2>Paste the job description</h2>
            <p className="hint">Copy the full job posting — the role, the skills it asks for, and the experience needed.</p>
            <textarea
              rows={8} value={jd} onChange={(e) => setJd(e.target.value)}
              placeholder="Example: Hiring a Senior Python Developer. Must have: Python, Django, REST APIs, 3+ years experience, AWS…"
            />
            <label className="exp-field">
              <span>Minimum years of experience <em>(optional)</em></span>
              <input type="number" min="0" step="0.5" value={minExp}
                onChange={(e) => setMinExp(e.target.value)} placeholder="e.g. 3" />
            </label>
          </section>

          <button className="cta" type="submit">
            <span className="cta-step">Step 3</span>
            Check my match →
          </button>
          <p className="cta-hint">You will see a score, what matched, and what is missing.</p>
        </form>
      )}

      {loading && (
        <section className="card loading-card">
          <div className="spinner" />
          <h2>Analyzing your resume…</h2>
          <div className="load-lines">
            {LOADING_LINES.map((line, i) => (
              <div key={line} className={`load-line ${i === loadLine ? 'active' : i < loadLine ? 'done' : ''}`}>
                {i < loadLine ? '✓' : i === loadLine ? '●' : '○'} {line}
              </div>
            ))}
          </div>
          <p className="hint">This usually takes 10–20 seconds.</p>
        </section>
      )}

      {result && r7 && !loading && (
        <div className="results">
          <section className="card hero-card">
            <div className="card-step">Your match</div>
            <div className="hero-score">
              <ScoreRing score={r7.score} />
              <div>
                <h2>{band.title}</h2>
                <p className="hint">{band.note}</p>
                <p className="fair">This is an assessment to help you decide — not a final hiring decision.</p>
              </div>
            </div>
            {!r7.meets_experience_requirement && (
              <div className="notice">
                Heads up: this job asks for about {result.step5_matching.hard_filter.min_experience_years} years
                of experience — we found around {r7.experience_years} in your resume.
              </div>
            )}
          </section>

          <section className="card">
            <h2>Skills the job wants that you have</h2>
            <p className="hint">These were found in your resume.</p>
            <div className="chips">
              {r7.matched_skills.length ? r7.matched_skills.map((s) => (
                <span key={s} className="chip chip-green">✓ {s}</span>
              )) : <span className="muted">None of the listed skills were found.</span>}
            </div>
          </section>

          <section className="card">
            <h2>Skills worth adding</h2>
            <p className="hint">The job mentions these, but we could not find them in your resume.</p>
            <div className="chips">
              {r7.missing_skills.length ? r7.missing_skills.map((s) => (
                <span key={s} className="chip chip-amber">{s}</span>
              )) : <span className="muted">Nothing missing — every skill the job lists was found.</span>}
            </div>
          </section>

          <section className="card">
            <h2>At a glance</h2>
            <div className="facts">
              <div className="fact"><span className="fact-num">{r7.experience_years}</span><span className="fact-label">years of experience (approx.)</span></div>
              <div className="fact"><span className="fact-num">{result.step3_preprocessing.skills_count}</span><span className="fact-label">skills detected</span></div>
              <div className="fact"><span className="fact-num">{r7.matched_skills.length}/{r7.matched_skills.length + r7.missing_skills.length}</span><span className="fact-label">required skills matched</span></div>
            </div>
            {(r7.degrees.length > 0 || r7.job_titles.length > 0) && (
              <div className="facts-text">
                {r7.degrees.length > 0 && <p><strong>Education:</strong> {r7.degrees.join(', ')}</p>}
                {r7.job_titles.length > 0 && <p><strong>Recent roles:</strong> {r7.job_titles.slice(0, 3).join(' · ')}</p>}
              </div>
            )}
          </section>

          <section className="card">
            <Collapsible title="How this works">
              <ol className="how-list">
                {PLAIN_STEPS.map((s) => (
                  <li key={s.key}><strong>{s.title}.</strong> {s.desc}</li>
                ))}
              </ol>
              <Collapsible title="For the technically curious — full pipeline output">
                {PLAIN_STEPS.map((s) => (
                  <Collapsible key={s.key} title={s.title}>
                    <pre className="json">{JSON.stringify(result[s.key], null, 2)}</pre>
                  </Collapsible>
                ))}
              </Collapsible>
            </Collapsible>
          </section>

          <section className="card feedback-card">
            <h2>Was this helpful?</h2>
            <div className="feedback-row">
              <button type="button" className="btn-ghost" onClick={() => sendFeedback(true)}>👍 Helpful</button>
              <button type="button" className="btn-ghost" onClick={() => sendFeedback(false)}>👎 Not helpful</button>
            </div>
            {feedbackMsg && <p className="muted">{feedbackMsg}</p>}
          </section>

          <button className="cta cta-secondary" type="button" onClick={reset}>
            Check another resume →
          </button>
        </div>
      )}

      <footer className="footer">
        <p>Demo screener — scores are similarity assessments, not hiring decisions. Names and contact details are never used in scoring.</p>
      </footer>
    </div>
  );
}
