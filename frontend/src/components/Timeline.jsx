import React from 'react';

/**
 * Animated vertical timeline of the 8 NLP pipeline stages.
 * stages: [{key, label, status: 'pending'|'active'|'done', summary}]
 * Summaries always come from real per-stage outputs passed in by the parent.
 */
export default function Timeline({ stages, compact = false }) {
  return (
    <div className={`timeline ${compact ? 'timeline-compact' : ''}`}>
      {stages.map((s, i) => (
        <div key={s.key} className={`tl-item ${s.status}`}>
          <div className="tl-rail">
            <div className="tl-node">
              {s.status === 'done' ? (
                <span className="tl-check">✓</span>
              ) : s.status === 'active' ? (
                <span className="tl-spinner" />
              ) : (
                <span className="tl-num">{i + 1}</span>
              )}
            </div>
            {i < stages.length - 1 && (
              <div className={`tl-line ${s.status === 'done' ? 'done' : ''}`} />
            )}
          </div>
          <div className="tl-body">
            <div className="tl-label">{s.label}</div>
            {s.status === 'active' && (
              <div className="tl-live">
                Working<span className="tl-ellipsis"><span>.</span><span>.</span><span>.</span></span>
              </div>
            )}
            {s.status === 'done' && s.summary && (
              <div className="tl-summary">{s.summary}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
