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
  'Strong match': '#0d9d6c',
  'Worth reviewing': '#d97706',
  'Weak match': '#94a3b8',
};

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function DocIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h6" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M12 12l4.5-4.5" />
      <path d="M20.2 15a8.5 8.5 0 1 0-16.4 0" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export default function Dashboard({ data, onNewScreening, onOpenSession }) {
  const loading = !data;
  const stats = (data && data.stats) || {};
  const recent = (data && data.recent_sessions) || [];
  const dist = (data && data.score_distribution) || [];

  const cards = [
    {
      label: 'Resumes uploaded', value: stats.total_resumes ?? 0, hint: 'across all screenings',
      icon: <DocIcon />, color: '#4f46e5', soft: '#eef0ff',
    },
    {
      label: 'Candidates processed', value: stats.candidates_processed ?? 0, hint: 'analysed by the NLP pipeline',
      icon: <UsersIcon />, color: '#0284c7', soft: '#e0f2fe',
    },
    {
      label: 'Shortlisted', value: stats.shortlisted ?? 0, hint: 'moved by you to shortlist',
      icon: <StarIcon />, color: '#0d9d6c', soft: '#dbf5e8',
    },
    {
      label: 'Average match score', value: `${Math.round((stats.avg_score || 0) * 100)}%`, hint: 'across all candidates',
      icon: <GaugeIcon />, color: '#d97706', soft: '#fdf1dc',
    },
  ];

  return (
    <div className="dash">
      <div className="dash-head rise">
        <div>
          <h2>Recruiter dashboard</h2>
          <p>Your screening activity at a glance. Scores are similarity assessments — you decide.</p>
        </div>
        <button type="button" className="btn-primary" onClick={onNewScreening}>
          Start new screening →
        </button>
      </div>

      <div className="stat-grid">
        {loading
          ? [0, 1, 2, 3].map((i) => (
            <div className="stat-card" key={i}>
              <div className="stat-top">
                <div className="stat-icon skeleton" style={{ width: 40, height: 40 }}>&nbsp;</div>
              </div>
              <div className="stat-value skeleton" style={{ width: '55%' }}>&nbsp;</div>
              <div className="stat-label skeleton" style={{ width: '75%', marginTop: 10 }}>&nbsp;</div>
            </div>
          ))
          : cards.map((c, i) => (
            <div className="stat-card rise" key={c.label}
              style={{ '--d': `${i * 70}ms`, '--sc': c.color, '--sc-soft': c.soft }}>
              <div className="stat-top">
                <span className="stat-icon">{c.icon}</span>
              </div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
              <div className="stat-hint">{c.hint}</div>
            </div>
          ))}
      </div>

      <div className="dash-cols">
        <div className="dash-panel rise" style={{ '--d': '140ms' }}>
          <h3>Score distribution</h3>
          <p className="panel-sub">How your candidates fall across verdict bands.</p>
          {loading ? (
            <div className="skeleton" style={{ height: 240, borderRadius: 12 }}>&nbsp;</div>
          ) : dist.every((d) => !d.count) ? (
            <div className="empty-note">
              <div className="empty-ico"><GaugeIcon /></div>
              No candidates yet — run your first screening to see the distribution.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dist} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9eef7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5d6c8f' }} interval={0}
                  tickLine={false} axisLine={{ stroke: '#e4e9f4' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#5d6c8f' }}
                  tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  cursor={{ fill: 'rgba(79,70,229,.06)' }}
                  contentStyle={{
                    borderRadius: 12, border: '1px solid #e4e9f4',
                    boxShadow: '0 12px 28px -8px rgba(15,26,51,.18)',
                    fontSize: 13, fontWeight: 600,
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={52}
                  background={{ fill: '#f1f4fa', radius: 8 }}>
                  {dist.map((d) => (
                    <Cell key={d.label} fill={BAND_COLORS[d.label] || '#7c8db0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dash-panel rise" style={{ '--d': '210ms' }}>
          <h3>Recent screening sessions</h3>
          <p className="panel-sub">Pick one up where you left off.</p>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 62, borderRadius: 12 }}>&nbsp;</div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="empty-note">
              <div className="empty-ico"><InboxIcon /></div>
              No screening sessions yet — your recent batches will appear here.
            </div>
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
