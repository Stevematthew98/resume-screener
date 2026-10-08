import React, { useState } from 'react';
import { blankStages, getCandidateStatuses, setCandidateStatus, streamScreen } from './api';
import JobSetup from './components/JobSetup';
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

export default function App() {
  const [view, setView] = useState('setup'); // setup | screening | ranking
  const [job, setJob] = useState(EMPTY_JOB);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const [total, setTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [pipes, setPipes] = useState([]); // [{key, filename, resume_id, stages, status}]
  const [screenError, setScreenError] = useState('');

  const [ranking, setRanking] = useState([]);
  const [candidates, setCandidates] = useState({});
  const [statuses, setStatuses] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  function updatePipe(key, fn) {
    setPipes((prev) => prev.map((p) => (p.key === key ? fn(p) : p)));
  }

  async function startScreening() {
    setError('');
    if (!job.title.trim()) { setError('Please give the role a job title.'); return; }
    if (!job.jdText.trim()) { setError('Please paste the job description.'); return; }
    if (!files.length) { setError('Please upload at least one resume.'); return; }

    const payload = toJobPayload(job);
    setPipes(files.map((f, i) => ({ key: `f${i}`, filename: f.name, resume_id: null, stages: blankStages(), status: 'queued' })));
    setTotal(files.length);
    setDoneCount(0);
    setCurrentFile('');
    setScreenError('');
    setRanking([]);
    setCandidates({});
    setView('screening');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const byIndex = {};
    try {
      await streamScreen(files, payload, (evt) => {
        if (evt.type === 'job_ready') {
          setTotal(evt.total);
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
              // activate the next pending stage after the one just completed
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
          // sync any statuses already known
          getCandidateStatuses().then((sv) => {
            setStatuses((prev) => ({ ...sv, ...prev }));
          }).catch(() => {});
          setTimeout(() => {
            setView('ranking');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 1200);
        }
      });
    } catch (e) {
      setScreenError(e.message || 'Screening failed. Please try again.');
    }
  }

  async function handleStatusChange(resume_id, status, notes, reject_reason) {
    const updated = await setCandidateStatus(resume_id, status, notes, reject_reason);
    setStatuses((prev) => ({
      ...prev,
      [resume_id]: { status: updated.status, notes: updated.notes, reject_reason: updated.reject_reason, filename: updated.filename },
    }));
  }

  function restart() {
    setView('setup');
    setFiles([]);
    setRanking([]);
    setCandidates({});
    setStatuses({});
    setSelectedId(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const selected = selectedId ? candidates[selectedId] : null;

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-glow" />
        <div className="hero-inner">
          <div className="hero-badge">Recruiter screening · NLP-powered</div>
          <h1>Resume Screener</h1>
          <p>Screen a whole batch of resumes against a role — watch the analysis happen, then work a ranked shortlist.</p>
        </div>
      </header>

      <nav className="viewtabs">
        {[
          ['setup', '1 · Job & resumes'],
          ['screening', '2 · Screening'],
          ['ranking', `3 · Shortlist${ranking.length ? ` (${ranking.length})` : ''}`],
        ].map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={`viewtab ${view === v ? 'active' : ''}`}
            disabled={v === 'screening' || (v === 'ranking' && !ranking.length)}
            onClick={() => v === 'setup' && setView('setup')}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === 'setup' && (
        <JobSetup job={job} setJob={setJob} files={files} setFiles={setFiles}
          onScreen={startScreening} error={error} />
      )}

      {view === 'screening' && (
        <ScreeningView total={total} doneCount={doneCount} currentFile={currentFile}
          resumes={pipes} error={screenError} />
      )}

      {view === 'ranking' && (
        <RankingView job={job} ranking={ranking} candidates={candidates} statuses={statuses}
          onSelectCandidate={setSelectedId} onStatusChange={handleStatusChange} onRestart={restart} />
      )}

      {selected && (
        <CandidateDetail
          candidate={selected}
          statusInfo={statuses[selected.resume_id] || { status: 'Screened', notes: '', reject_reason: '' }}
          onClose={() => setSelectedId(null)}
          onStatus={handleStatusChange}
        />
      )}

      <footer className="footer">
        <p>Screening scores are similarity assessments to assist your decision — never hiring decisions. Names, colleges and contact details are never used in scoring, and no candidate is ever rejected automatically.</p>
      </footer>
    </div>
  );
}
