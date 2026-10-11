import Button from './Button';
import { BriefcaseBusiness, History, Plus, Trash2, ArrowRight } from 'lucide-react';
import React, { useState } from 'react';
import { deleteJob } from '../api';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function JobsView({ jobs, loading = false, error: loadError = '', onRefresh, onScreenJob, onNewJob }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function handleDelete(id) {
    if (!window.confirm('Delete this job profile? Its screening history stays saved.')) return;
    setBusyId(id);
    setError('');
    try {
      await deleteJob(id);
      onRefresh();
    } catch (e) {
      setError(e.message || 'Could not delete the job.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="jobs">
      <div className="dash-head">
        <div>
          <h2>Job profiles</h2>
          <p>Save roles once, then screen candidates against any of them.</p>
        </div>
        <Button type="button" className="btn-primary" onClick={onNewJob}>
          <Plus size={16} /> New screening
        </Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? <div className="stat-grid" role="status" aria-label="Loading jobs">{[0,1,2].map(i => <div key={i} className="skeleton" style={{height: 140}} />)}</div> : loadError ? <div className="empty-note">Jobs are currently unavailable.</div> : jobs.length === 0 ? (
        <div className="empty-card"><div className="empty-ico"><BriefcaseBusiness size={22} /></div>
          <h3>No job profiles yet</h3>
          <p>Start a screening and your job will be saved here automatically — or create one from scratch.</p>
          <Button type="button" className="btn-primary" onClick={onNewJob}>Start your first screening →</Button>
        </div>
      ) : (
        <div className="job-grid">
          {jobs.map((j) => (
            <div className="job-card" key={j.id}>
              <div className="job-card-top">
                <h3>{j.title}</h3>
                {j.company && <div className="muted">{j.company}</div>}
              </div>
              <div className="job-skills">
                {(j.required_skills || []).slice(0, 6).map((s) => (
                  <span className="skill-chip sm" key={s}>{s}</span>
                ))}
                {(j.required_skills || []).length > 6 && (
                  <span className="muted sm">+{(j.required_skills || []).length - 6} more</span>
                )}
              </div>
              <div className="job-meta muted sm">
                {j.min_experience_years ? `${j.min_experience_years} yrs min` : 'No min. experience'}
                {' · '}{j.sessions_count || 0} screening{(j.sessions_count || 0) === 1 ? '' : 's'}
                {' · '}saved {fmtDate(j.created_at)}
              </div>
              <div className="job-actions">
                <Button type="button" className="btn-primary btn-sm" onClick={() => onScreenJob(j)}>
                  Screen candidates <ArrowRight size={14} />
                </Button>
                <Button type="button" className="btn-ghost btn-sm" disabled={busyId === j.id}
                  onClick={() => handleDelete(j.id)}>
                  {busyId === j.id ? 'Deleting…' : <><Trash2 size={14} /> Delete</>}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
