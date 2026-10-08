import React, { useState } from 'react';
import Timeline from './Timeline';

/**
 * Live screening view: overall batch progress plus a per-resume pipeline
 * timeline that fills in as real SSE stage events arrive.
 */
export default function ScreeningView({ total, doneCount, currentFile, resumes, error }) {
  const [openId, setOpenId] = useState(null);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div>
      <section className="card rise">
        <div className="card-eyebrow">Screening in progress</div>
        <h2>{doneCount < total ? `Analysing resume ${Math.min(doneCount + 1, total)} of ${total}…` : 'Finishing up…'}</h2>
        <p className="hint">
          {currentFile ? <>Now reading: <strong>{currentFile}</strong></> : 'Starting the pipeline…'}
        </p>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-meta">
          <span>{doneCount} of {total} resumes screened</span>
          <span>{pct}%</span>
        </div>
        {error && <div className="alert">{error}</div>}
      </section>

      <div className="resume-pipes">
        {resumes.map((r) => {
          const doneStages = r.stages.filter((s) => s.status === 'done').length;
          const open = openId === r.key || (r.status === 'running' && openId === null);
          return (
            <section key={r.key} className={`card pipe-card rise ${r.status}`}>
              <button
                type="button"
                className="pipe-head"
                onClick={() => setOpenId(open && openId ? null : r.key)}
              >
                <span className={`pipe-status-dot ${r.status}`} />
                <span className="pipe-name">{r.filename}</span>
                <span className="pipe-count">{r.status === 'error' ? 'failed' : `${doneStages}/8 stages`}</span>
                <span className={`chev ${open ? 'open' : ''}`}>▾</span>
              </button>
              {open && (
                <div className="pipe-body">
                  {r.status === 'error'
                    ? <p className="hint">This file could not be analysed. The rest of the batch continued.</p>
                    : <Timeline stages={r.stages} compact />}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="screen-note">
        Each resume goes through the same 8-step analysis: reading the text, finding skills,
        comparing meaning with the job, scoring, and explaining the result. Nothing is skipped, nothing is faked.
      </p>
    </div>
  );
}
