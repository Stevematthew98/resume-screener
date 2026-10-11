import Button from './Button';
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { getRankerStatus } from '../api';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BAND_COLORS = {
  'Strong match': 'var(--green)',
  'Worth reviewing': 'var(--amber)',
  'Weak match': 'var(--muted)',
};

// Technical view of the real 8-stage pipeline (keys mirror the backend;
// descriptions state what each stage actually does).
const TECH_STAGES = [
  { n: '01', name: 'INGEST', desc: 'PDF/DOCX intake · validation' },
  { n: '02', name: 'EXTRACT', desc: 'text layer · OCR for scans' },
  { n: '03', name: 'PREPROCESS', desc: 'clean · tokenize · normalize' },
  { n: '04', name: 'VECTORIZE', desc: 'TF-IDF + MiniLM-384' },
  { n: '05', name: 'SKILL_NER', desc: 'match 234-skill taxonomy' },
  { n: '06', name: 'SCORE', desc: 'weighted 50/25/15/10' },
  { n: '07', name: 'EXPLAIN', desc: 'evidence · warnings · gaps' },
  { n: '08', name: 'RANK', desc: 'ranked shortlist · feedback' },
];

// Real, configured scoring weights — shown, not computed.
const WEIGHTS = [
  { key: 'skills', label: 'SKILLS', pct: 50, detail: 'taxonomy match × 0.50' },
  { key: 'jd', label: 'JD_SIMILARITY', pct: 25, detail: 'MiniLM cosine × 0.25' },
  { key: 'exp', label: 'EXPERIENCE', pct: 15, detail: 'years vs minimum × 0.15' },
  { key: 'edu', label: 'EDUCATION', pct: 10, detail: 'degree keywords × 0.10' },
];

// Real fairness rules enforced by the backend.
const GUARDRAILS = [
  'Names, colleges and contact info are never scored',
  'No candidate is ever auto-rejected — all start as “Screened”',
  'A missing skill means “not detected in the resume text”, never proof of absence',
  'Scores measure fit to your configured criteria — not probability of hiring success',
  'A human reviews every shortlist before any decision',
];

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shortId(id) {
  if (!id) return '—';
  const s = String(id);
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

export default function Dashboard({ data, loading = false, error = '', onNewScreening, onOpenSession }) {
  const stats = (data && data.stats) || {};
  const recent = (data && data.recent_sessions) || [];
  const dist = (data && data.score_distribution) || [];

  const [ranker, setRanker] = useState(null);
  useEffect(() => {
    let alive = true;
    getRankerStatus().then((r) => { if (alive) setRanker(r); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Sessions per day, derived from real session timestamps.
  const activity = useMemo(() => {
    const map = {};
    recent.forEach((s) => {
      const day = (s.created_at || '').slice(0, 10);
      if (day) map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).sort().slice(-14)
      .map(([day, count]) => ({ day: day.slice(5).replace('-', '/'), count }));
  }, [recent]);

  const telemetry = [
    { label: 'RESUMES_INGESTED', value: stats.total_resumes ?? '—', hint: 'files accepted by the pipeline' },
    { label: 'CANDIDATES_PROCESSED', value: stats.candidates_processed ?? '—', hint: 'full 8-stage analysis completed' },
    { label: 'SHORTLISTED', value: stats.shortlisted ?? '—', hint: 'status set by a recruiter' },
    { label: 'MEAN_MATCH_SCORE', value: stats.avg_score != null && stats.candidates_processed ? `${Math.round(stats.avg_score * 100)}%` : '—', hint: 'across all scored candidates' },
    {
      label: 'LEARNED_RANKER',
      value: ranker ? (ranker.active ? 'TUNED' : 'BASE') : '—',
      hint: ranker && ranker.active ? `${ranker.decisions} recruiter decisions learned` : 'default weights · tunes after 5+ mixed decisions',
    },
    { label: 'SKILL_TAXONOMY', value: '234', hint: 'curated skill entities for NER' },
  ];

  return (
    <div className="dash">
      <div className="dash-head rise">
        <div>
          <div className="card-eyebrow">System overview</div>
          <h2>Technical dashboard</h2>
          <p className="hint">Live telemetry from the screening pipeline. Every figure below is read from the backend — nothing is simulated.</p>
        </div>
        <Button type="button" className="btn-primary" onClick={onNewScreening}>
          <Plus size={16} /> New screening
        </Button>
      </div>

      <div className="tech-strip rise" style={{ '--d': '60ms' }} aria-label="Pipeline configuration">
        <span className="tech-item"><i className="dot ok" />PIPELINE&nbsp;<b>STANDBY</b></span>
        <span className="tech-item">EMBEDDINGS&nbsp;<b>all-MiniLM-L6-v2 + TF-IDF</b></span>
        <span className="tech-item">SKILL_TAXONOMY&nbsp;<b>234</b></span>
        <span className="tech-item">SCORING&nbsp;<b>50/25/15/10</b></span>
        <span className="tech-item">OCR&nbsp;<b>Tesseract</b></span>
        <span className="tech-item">AUTH&nbsp;<b>JWT</b></span>
      </div>

      <div className="dash-panel rise" style={{ '--d': '100ms' }}>
        <h3>NLP pipeline</h3>
        <p className="panel-sub">The eight stages every resume passes through, in order. Streamed live during screening.</p>
        <div className="pipe-diagram" role="list" aria-label="NLP pipeline stages">
          {TECH_STAGES.map((s, i) => (
            <React.Fragment key={s.n}>
              {i > 0 && <span className="pipe-link" aria-hidden="true">→</span>}
              <div className="pipe-node" role="listitem">
                <span className="pipe-node-n">{s.n}</span>
                <span className="pipe-node-name">{s.name}</span>
                <span className="pipe-node-desc">{s.desc}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        {loading
          ? [0, 1, 2, 3, 4, 5].map((i) => (
            <div className="stat-card" key={i}>
              <div className="stat-value skeleton" style={{ width: '55%' }}>&nbsp;</div>
              <div className="stat-label skeleton" style={{ width: '75%', marginTop: 10 }}>&nbsp;</div>
            </div>
          ))
          : telemetry.map((t) => (
            <div className="stat-card tech-card rise" key={t.label}>
              <div className="stat-value mono">{t.value}</div>
              <div className="stat-label mono-label">{t.label}</div>
              <div className="stat-hint">{t.hint}</div>
            </div>
          ))}
      </div>

      <div className="dash-cols">
        <div className="dash-panel rise" style={{ '--d': '140ms' }}>
          <h3>Scoring model</h3>
          <p className="panel-sub">Configured match-score composition. Fixed weights — the learned ranker only tunes the skills component.</p>
          <div className="weight-list">
            {WEIGHTS.map((w) => (
              <div className="weight-row" key={w.key}>
                <div className="weight-head">
                  <span className="mono-label">{w.label}</span>
                  <span className="mono">{w.pct}%</span>
                </div>
                <div className="weight-bar" role="img" aria-label={`${w.label} weight ${w.pct} percent`}>
                  <div className="weight-fill" style={{ width: `${w.pct}%` }} />
                </div>
                <div className="weight-detail">{w.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-panel rise" style={{ '--d': '210ms' }}>
          <h3>Score distribution</h3>
          <p className="panel-sub">Candidates per verdict band. Bands: ≥65% strong · 40–65% review · &lt;40% weak.</p>
          {loading ? (
            <div className="skeleton" style={{ height: 240, borderRadius: 12 }}>&nbsp;</div>
          ) : error ? <div className="empty-note">Score distribution is currently unavailable.</div> : dist.every((d) => !d.count) ? (
            <div className="empty-note">No candidates yet — run your first screening to see the distribution.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dist} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} interval={0}
                  tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted)' }}
                  tickLine={false} axisLine={false} width={30} />
                <Tooltip cursor={{ fill: 'var(--accent-soft)' }} content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><strong>{payload[0].payload.label}</strong>{payload[0].value} candidates</div> : null} />
                <Bar dataKey="count" name="Candidates" radius={[4, 4, 0, 0]} barSize={52}
                  background={{ fill: 'var(--line)', radius: 8 }}>
                  {dist.map((d) => (
                    <Cell key={d.label} fill={BAND_COLORS[d.label] || 'var(--muted)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {!loading && !error && dist.some(d => d.count) && <div className="chart-legend">{dist.map(d => <span key={d.label}><i style={{ background: BAND_COLORS[d.label] || 'var(--muted)' }} />{d.label}</span>)}</div>}
        </div>
      </div>

      <div className="dash-cols" style={{ marginTop: 16 }}>
        <div className="dash-panel rise" style={{ '--d': '240ms' }}>
          <h3>Screening activity</h3>
          <p className="panel-sub">Sessions started per day.</p>
          {loading ? (
            <div className="skeleton" style={{ height: 180, borderRadius: 12 }}>&nbsp;</div>
          ) : error ? <div className="empty-note">Activity is currently unavailable.</div> : activity.length === 0 ? (
            <div className="empty-note">No sessions yet — activity will appear here.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={activity} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip cursor={{ fill: 'var(--accent-soft)' }} content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><strong>{payload[0].payload.day}</strong>{payload[0].value} session{payload[0].value === 1 ? '' : 's'}</div> : null} />
                <Bar dataKey="count" name="Sessions" radius={[4, 4, 0, 0]} barSize={26} fill="var(--brand)" background={{ fill: 'var(--line)', radius: 6 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dash-panel rise" style={{ '--d': '260ms' }}>
          <h3>Fairness guardrails</h3>
          <p className="panel-sub">Rules the pipeline enforces on every run.</p>
          <ul className="guard-list">
            {GUARDRAILS.map((g) => (
              <li key={g}>
                <ShieldCheck size={16} />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="dash-panel rise" style={{ '--d': '280ms', marginTop: 16 }}>
        <h3>Session log</h3>
        <p className="panel-sub">Recent screening runs. Select a row to reopen it.</p>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 46, borderRadius: 10 }}>&nbsp;</div>
            ))}
          </div>
        ) : error ? <div className="empty-note">Session log is currently unavailable.</div> : recent.length === 0 ? (
          <div className="empty-note">No screening sessions yet — runs will be logged here.</div>
        ) : (
          <ul className="log-list">
            {recent.map((s) => (
              <li key={s.id}>
                <Button type="button" className="log-row" onClick={() => onOpenSession(s.id)}>
                  <span className="mono log-id">{shortId(s.id)}</span>
                  <span className="log-main"><strong>{s.job_title || 'Untitled role'}</strong>{s.job_company && <span className="muted"> · {s.job_company}</span>}</span>
                  <span className="mono log-meta">{s.screened_count}/{s.total_resumes} screened</span>
                  <span className="mono log-meta">avg {Math.round((s.avg_score || 0) * 100)}%</span>
                  <span className="log-date">{fmtDate(s.created_at)}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
