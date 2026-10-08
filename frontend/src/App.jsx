import React, { useCallback, useEffect, useState } from 'react';
import {
  blankStages,
  createJob,
  downloadExport,
  getCandidateStatuses,
  getDashboard,
  getMe,
  getSessionDetail,
  getToken,
  listJobs,
  listSessions,
  logout as apiLogout,
  setCandidateStatus,
  streamScreen,
} from './api';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import JobsView from './components/JobsView';
import JobSetup from './components/JobSetup';
import Login from './components/Login';
import ScreeningView from './components/ScreeningView';
import RankingView, { CandidateDetail } from './components/RankingView';

const EMPTY_JOB = {
  title: '',
  company: '',
  jdText: '',
  requiredSkills: '',
  preferredSkills: '',
  minExp: '',
  eduReq: '',
};

function toJobPayload(job) {
  return {
    title: job.title.trim(),
    company: job.company.trim(),
    jd_text: job.jdText.trim(),
    required_skills: job.requiredSkills,
    preferred_skills: job.preferredSkills,
    min_experience_years: job.minExp === '' ? 0 : Number(job.minExp) || 0,
    education_requirements: job.eduReq.trim(),
  };
}

function jobToForm(j) {
  return {
    title: j.title || '',
    company: j.company || '',
    jdText: j.jd_text || '',
    requiredSkills: (j.required_skills || []).join(', '),
    preferredSkills: (j.preferred_skills || []).join(', '),
    minExp: j.min_experience_years ? String(j.min_experience_years) : '',
    eduReq: j.education_requirements || '',
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [view, setView] = useState('dashboard'); // dashboard | jobs | history | setup | screening | ranking | historyDetail
  const [job, setJob] = useState(EMPTY_JOB);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [activeJobId, setActiveJobId] = useState(null);

  const [total, setTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [pipes, setPipes] = useState([]);
  const [screenError, setScreenError] = useState('');

  const [ranking, setRanking] = useState([]);
  const [candidates, setCandidates] = useState({});
  const [statuses, setStatuses] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [dashData, setDashData] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);

  function handleSessionExpired() {
    apiLogout();
    setUser(null);
    setView('dashboard');
  }

  const guard = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (e.sessionExpired) handleSessionExpired();
      throw e;
    }
  }, []);

  // Restore session on load
  useEffect(() => {
    if (!getToken()) { setAuthChecked(true); return; }
    getMe()
      .then((u) => setUser(u))
      .catch(() => apiLogout())
      .finally(() => setAuthChecked(true));
  }, []);

  const refreshJobs = useCallback(() => guard(() => listJobs().then(setJobs)), [guard]);
  const refreshSessions = useCallback(() => guard(() => listSessions().then(setSessions)), [guard]);
  const refreshDashboard = useCallback(() => guard(() => getDashboard().then(setDashData)), [guard]);

  useEffect(() => {
    if (user) {
      refreshDashboard().catch(() => {});
      refreshJobs().catch(() => {});
      refreshSessions().catch(() => {});
    }
  }, [user, refreshDashboard, refreshJobs, refreshSessions]);

  function updatePipe(key, fn) {
    setPipes((prev) => prev.map((p) => (p.key === key ? fn(p) : p)));
  }

  function goSetup(prefillJob) {
    if (prefillJob) {
      setJob(jobToForm(prefillJob));
      setActiveJobId(prefillJob.id);
    } else {
      setJob(EMPTY_JOB);
      setActiveJobId(null);
    }
    setFiles([]);
    setError('');
    setView('setup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function startScreening() {
    setError('');
    if (!job.title.trim()) { setError('Please give the role a job title.'); return; }
    if (!job.jdText.trim()) { setError('Please paste the job description.'); return; }
    if (!files.length) { setError('Please upload at least one resume.'); return; }

    const payload = toJobPayload(job);
    let jobId = activeJobId;
    try {
      // Auto-save ad-hoc jobs so every run is linked to a job profile + history.
      if (!jobId) {
        const created = await guard(() => createJob(payload));
        jobId = created.id;
        setActiveJobId(jobId);
        refreshJobs().catch(() => {});
      }
    } catch (e) {
      setError(e.message || 'Could not save the job profile.');
      return;
    }

    setPipes(files.map((f, i) => ({ key: `f${i}`, filename: f.name, resume_id: null, stages: blankStages(), status: 'queued' })));
    setTotal(files.length);
    setDoneCount(0);
    setCurrentFile('');
    setScreenError('');
    setRanking([]);
    setCandidates({});
    setStatuses({});
    setSessionId(null);
    setView('screening');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const byIndex = {};
    try {
      await streamScreen(files, payload, (evt) => {
        if (evt.type === 'job_ready') {
          setTotal(evt.total);
          if (evt.session_id) setSessionId(evt.session_id);
        } else if (evt.type === 'resume_start') {
          const key = `f${evt.index}`;
          byIndex[evt.index] = evt.resume_id;
          setCurrentFile(evt.filename);
          updatePipe(key, (p) => ({
            ...p,
            resume_id: evt.resume_id,
            status: 'running',
            stages: p.stages.map((s, i) => (i === 0 ? { ...s, status: 'active' } : s)),
          }));
        } else if (evt.type === 'stage') {
          const key = `f${evt.index}`;
          updatePipe(key, (p) => ({
            ...p,
            stages: p.stages.map((s) => {
              if (s.key === evt.stage) return { ...s, status: 'done', summary: evt.summary };
              if (s.status === 'active') return { ...s, status: 'done', summary: s.summary };
              return s;
            }).map((s, i, arr) => {
              const doneIdx = arr.findIndex((x) => x.key === evt.stage);
              if (i === doneIdx + 1 && s.status === 'pending') return { ...s, status: 'active' };
              return s;
            }),
          }));
        } else if (evt.type === 'resume_done') {
          const key = `f${evt.index}`;
          setCandidates((prev) => ({ ...prev, [evt.resume_id]: evt.candidate }));
          setStatuses((prev) => ({
            ...prev,
            [evt.resume_id]: { status: 'Screened', notes: '', reject_reason: '', filename: evt.filename },
          }));
          updatePipe(key, (p) => ({
            ...p,
            status: 'done',
            stages: p.stages.map((s) => (s.status === 'done' ? s : { ...s, status: 'done', summary: s.summary })),
          }));
          setDoneCount((c) => c + 1);
        } else if (evt.type === 'resume_error') {
          const key = `f${evt.index}`;
          updatePipe(key, (p) => ({ ...p, status: 'error' }));
          setDoneCount((c) => c + 1);
        } else if (evt.type === 'batch_complete') {
          setRanking(evt.ranking || []);
          if (evt.session_id) setSessionId(evt.session_id);
          getCandidateStatuses(evt.session_id).then((sv) => {
            setStatuses((prev) => ({ ...sv, ...prev }));
          }).catch(() => {});
          refreshDashboard().catch(() => {});
          refreshSessions().catch(() => {});
          setTimeout(() => {
            setView('ranking');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 1200);
        }
      }, { jobId });
    } catch (e) {
      if (e.sessionExpired) { handleSessionExpired(); return; }
      setScreenError(e.message || 'Screening failed. Please try again.');
    }
  }

  async function handleStatusChange(resume_id, status, notes, reject_reason) {
    const updated = await guard(() => setCandidateStatus(resume_id, status, notes, reject_reason));
    setStatuses((prev) => ({
      ...prev,
      [resume_id]: { status: updated.status, notes: updated.notes, reject_reason: updated.reject_reason, filename: updated.filename },
    }));
    if (historyDetail) {
      setHistoryDetail((prev) => prev && ({
        ...prev,
        candidates: {
          ...prev.candidates,
          [resume_id]: prev.candidates[resume_id]
            ? { ...prev.candidates[resume_id], status: updated.status, notes: updated.notes, reject_reason: updated.reject_reason }
            : prev.candidates[resume_id],
        },
      }));
    }
  }

  async function openSession(id) {
    try {
      const detail = await guard(() => getSessionDetail(id));
      const st = {};
      (detail.ranking || []).forEach((r) => {
        st[r.resume_id] = { status: r.status || 'Screened', notes: r.notes || '', reject_reason: r.reject_reason || '', filename: r.filename };
      });
      setStatuses(st);
      setHistoryDetail(detail);
      setSelectedId(null);
      setView('historyDetail');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert(e.message || 'Could not open the session.');
    }
  }

  async function handleExport(kind) {
    const id = sessionId || (historyDetail && historyDetail.id);
    if (!id) return;
    await guard(() => downloadExport(id, kind));
  }

  function handleLogout() {
    apiLogout();
    setUser(null);
    setView('dashboard');
    setDashData(null);
    setJobs([]);
    setSessions([]);
  }

  function restart() {
    setView('setup');
    setJob(EMPTY_JOB);
    setActiveJobId(null);
    setFiles([]);
    setRanking([]);
    setCandidates({});
    setStatuses({});
    setSelectedId(null);
    setSessionId(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const selected = selectedId ? (candidates[selectedId] || (historyDetail && historyDetail.candidates[selectedId])) : null;
  const selectedStatus = selectedId
    ? (statuses[selectedId] || { status: (selected && selected.status) || 'Screened', notes: '', reject_reason: '' })
    : null;
  const isHistoryDetail = view === 'historyDetail';

  if (!authChecked) {
    return <div className="page"><p className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading…</p></div>;
  }

  if (!user) {
    return (
      <div className="page">
        <Login onAuth={(u) => { setUser(u); setView('dashboard'); }} />
      </div>
    );
  }

  const nav = [
    ['dashboard', 'Dashboard'],
    ['jobs', 'Jobs'],
    ['history', 'History'],
  ];

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-glow" />
        <div className="hero-inner">
          <div className="hero-badge">Recruiter screening · NLP-powered</div>
          <h1>Resume Screener</h1>
          <p>Screen a whole batch of resumes against a role — watch the analysis happen, then work a ranked shortlist.</p>
        </div>
        <div className="userbar">
          <span className="user-chip">{user.name || user.email}</span>
          <button type="button" className="btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <nav className="viewtabs main-nav">
        {nav.map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={`viewtab ${view === v || (v === 'history' && isHistoryDetail) ? 'active' : ''}`}
            onClick={() => {
              if (v === 'dashboard') refreshDashboard().catch(() => {});
              if (v === 'jobs') refreshJobs().catch(() => {});
              if (v === 'history') refreshSessions().catch(() => {});
              setView(v);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            {label}
          </button>
        ))}
        {['setup', 'screening', 'ranking'].includes(view) && (
          <span className="viewtab active">Screening flow</span>
        )}
      </nav>

      {view === 'dashboard' && (
        <Dashboard
          data={dashData}
          onNewScreening={() => goSetup(null)}
          onOpenSession={openSession}
        />
      )}

      {view === 'jobs' && (
        <JobsView
          jobs={jobs}
          onRefresh={refreshJobs}
          onScreenJob={(j) => goSetup(j)}
          onNewJob={() => goSetup(null)}
        />
      )}

      {view === 'history' && (
        <HistoryView sessions={sessions} onOpenSession={openSession} />
      )}

      {view === 'setup' && (
        <>
          <button type="button" className="back-link" onClick={() => setView(activeJobId ? 'jobs' : 'dashboard')}>
            ← Back
          </button>
          <JobSetup job={job} setJob={setJob} files={files} setFiles={setFiles}
            onScreen={startScreening} error={error} />
        </>
      )}

      {view === 'screening' && (
        <ScreeningView total={total} doneCount={doneCount} currentFile={currentFile}
          resumes={pipes} error={screenError} />
      )}

      {view === 'ranking' && (
        <RankingView job={job} ranking={ranking} candidates={candidates} statuses={statuses}
          onSelectCandidate={setSelectedId} onStatusChange={handleStatusChange} onRestart={restart}
          sessionId={sessionId} onExport={handleExport} />
      )}

      {isHistoryDetail && historyDetail && (
        <RankingView
          job={{ title: historyDetail.job_title, company: historyDetail.job_company }}
          ranking={historyDetail.ranking || []}
          candidates={historyDetail.candidates || {}}
          statuses={statuses}
          onSelectCandidate={setSelectedId}
          onStatusChange={handleStatusChange}
          onRestart={restart}
          sessionId={historyDetail.id}
          readOnly
          onExport={handleExport}
          onBack={() => { setView('history'); setHistoryDetail(null); }}
        />
      )}

      {selected && (
        <CandidateDetail
          candidate={selected}
          statusInfo={selectedStatus}
          onClose={() => setSelectedId(null)}
          onStatus={isHistoryDetail ? null : handleStatusChange}
          readOnly={isHistoryDetail}
        />
      )}

      <footer className="footer">
        <p>Screening scores are similarity assessments to assist your decision — never hiring decisions. Names, colleges and contact details are never used in scoring, and no candidate is ever rejected automatically.</p>
      </footer>
    </div>
  );
}
