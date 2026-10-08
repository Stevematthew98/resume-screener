import React from 'react';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryView({ sessions, onOpenSession }) {
  return (
    <div className="history">
      <div className="dash-head">
        <div>
          <h2>Screening history</h2>
          <p>Every batch you've screened, with its ranking snapshot saved.</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-card">
          <h3>No sessions yet</h3>
          <p>Run your first screening and it will appear here with the full ranking.</p>
        </div>
      ) : (
        <ul className="session-list big">
          {sessions.map((s) => (
            <li key={s.id}>
              <button type="button" className="session-row" onClick={() => onOpenSession(s.id)}>
                <span className="session-main">
                  <strong>#{s.id} · {s.job_title || 'Untitled role'}</strong>
                  {s.job_company && <span className="muted"> · {s.job_company}</span>}
                </span>
                <span className="session-meta">
                  {s.screened_count}/{s.total_resumes} screened · avg {Math.round((s.avg_score || 0) * 100)}%
                </span>
                <span className="session-date">{fmtDate(s.created_at)}</span>
                <span className="link-arrow">View →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
