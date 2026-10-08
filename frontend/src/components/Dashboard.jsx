import React from 'react';
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
  'Strong match': '#0e9f6e',
  'Worth reviewing': '#d97706',
  'Weak match': '#64748b',
};

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard({ data, onNewScreening, onOpenSession }) {
  const stats = (data && data.stats) || {};
  const recent = (data && data.recent_sessions) || [];
  const dist = (data && data.score_distribution) || [];

  const cards = [
    { label: 'Resumes uploaded', value: stats.total_resumes ?? 0, hint: 'across all screenings' },
    { label: 'Candidates processed', value: stats.candidates_processed ?? 0, hint: 'analysed by the NLP pipeline' },
    { label: 'Shortlisted', value: stats.shortlisted ?? 0, hint: 'moved by you to shortlist' },
    { label: 'Average match score', value: `${Math.round((stats.avg_score || 0) * 100)}%`, hint: 'across all candidates' },
  ];

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h2>Recruiter dashboard</h2>
          <p>Your screening activity at a glance. Scores are similarity assessments — you decide.</p>
        </div>
        <button type="button" className="btn-primary" onClick={onNewScreening}>
          Start new screening →
        </button>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-hint">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="dash-cols">
        <div className="dash-panel">
          <h3>Score distribution</h3>
          <p className="panel-sub">How your candidates fall across verdict bands.</p>
          {dist.every((d) => !d.count) ? (
            <div className="empty-note">No candidates yet — run your first screening to see the distribution.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dist} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf4" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {dist.map((d) => (
                    <Cell key={d.label} fill={BAND_COLORS[d.label] || '#7c8db0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dash-panel">
          <h3>Recent screening sessions</h3>
          <p className="panel-sub">Pick one up where you left off.</p>
          {recent.length === 0 ? (
            <div className="empty-note">No screening sessions yet.</div>
          ) : (
            <ul className="session-list">
              {recent.map((s) => (
                <li key={s.id}>
                  <button type="button" className="session-row" onClick={() => onOpenSession(s.id)}>
                    <span className="session-main">
                      <strong>{s.job_title || 'Untitled role'}</strong>
                      {s.job_company && <span className="muted"> · {s.job_company}</span>}
                    </span>
                    <span className="session-meta">
                      {s.screened_count}/{s.total_resumes} screened · avg {Math.round((s.avg_score || 0) * 100)}%
                    </span>
                    <span className="session-date">{fmtDate(s.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
