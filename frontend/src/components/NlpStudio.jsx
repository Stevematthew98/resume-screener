import React, { useEffect, useState } from 'react';
import Button from './Button';
import StageWorkbench from './studio/StageWorkbench';
import { GROUPS, STAGES_ENRICHED } from './studio/studioStages';
import { STAGE_ORDER } from '../api';
import {
  BookOpen, Brain, Briefcase, Calculator, CaseSensitive, CheckCircle2, ClipboardList,
  FileInput, FileText, Filter, Flag, GitCompareArrows, LayoutList, MessageSquareText,
  Network, ScanSearch, Scissors, Sparkles, Tags, TriangleAlert, Trophy,
} from 'lucide-react';

const ICONS = {
  FileInput, FileText, Sparkles, CaseSensitive, Scissors, Tags, Filter, BookOpen,
  LayoutList, ScanSearch, Brain, Briefcase, ClipboardList, Network, GitCompareArrows,
  Calculator, Trophy, TriangleAlert, MessageSquareText, Flag,
};

const toSpec = (s) => s === 'done' ? 'completed' : s === 'active' ? 'processing' : s === 'pending' ? 'waiting' : 'failed';

function fmtDur(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function NlpStudio({
  total, doneCount, currentFile, resumes, candidates, ranking,
  job, error, startedAt, batchComplete, onViewRanking,
}) {
  const [selResumeKey, setSelResumeKey] = useState(null);
  const [pinnedStage, setPinnedStage] = useState(null);
  const [showSummary, setShowSummary] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const running = resumes.find((r) => r.status === 'running');
  const selected = (selResumeKey && resumes.find((r) => r.key === selResumeKey)) || running || resumes[0] || null;

  // Execution state per real backend stage for the selected resume.
  const exec = {};
  if (selected) {
    selected.stages.forEach((s) => {
      exec[s.key] = { status: s.status, completedAt: s.completedAt || null, detail: s.detail || null, summary: s.summary };
    });
  }
  exec.__batch__ = {
    status: batchComplete ? 'done' : (selected && selected.status === 'done' ? 'active' : 'pending'),
    completedAt: batchComplete ? now : null, detail: null,
  };

  // Real per-stage durations from completion timestamps.
  const durations = {};
  let prev = (selected && selected.startedAt) || startedAt;
  [...STAGE_ORDER, '__batch__'].forEach((k) => {
    const e = exec[k];
    if (e && e.completedAt && prev) durations[k] = e.completedAt - prev;
    if (e && e.completedAt) prev = e.completedAt;
  });

  const failed = selected && selected.status === 'error';

  // Auto-follow the live stage unless the user pinned one.
  let autoStage = 1;
  if (selected) {
    const activeExec = selected.stages.find((s) => s.status === 'active');
    if (activeExec) {
      const first = STAGES_ENRICHED.find((st) => st.execKey === activeExec.key);
      if (first) autoStage = first.n;
    } else {
      const lastDone = [...selected.stages].reverse().find((s) => s.status === 'done');
      if (lastDone) {
        const group = STAGES_ENRICHED.filter((st) => st.execKey === lastDone.key);
        autoStage = group.length ? group[group.length - 1].n : 1;
      }
    }
  }
  const selStageN = pinnedStage || autoStage;
  const stage = STAGES_ENRICHED.find((s) => s.n === selStageN) || STAGES_ENRICHED[0];
  const stageExec = exec[stage.execKey] || { status: 'pending' };
  const specStatus = failed ? 'failed' : toSpec(stageExec.status);

  const candidate = selected && selected.resume_id ? candidates[selected.resume_id] : null;
  const rankIdx = selected && ranking ? ranking.findIndex((r) => r.resume_id === selected.resume_id) : -1;

  const ctx = {
    candidate, ranking: ranking || [], rank: rankIdx >= 0 ? rankIdx + 1 : null,
    job, resumeId: selected ? selected.resume_id : null,
  };

  // Progress header numbers.
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const elapsed = startedAt ? now - startedAt : 0;
  const rate = elapsed > 0 && doneCount > 0 ? doneCount / elapsed : 0;
  const eta = rate > 0 && doneCount < total ? Math.round((total - doneCount) / rate) : null;
  const activeLabel = running
    ? (running.stages.find((s) => s.status === 'active') || {}).label || 'Working…'
    : batchComplete ? 'Complete' : 'Starting…';

  const summaryStats = (() => {
    if (!batchComplete) return null;
    const cands = Object.values(candidates || {});
    const scores = cands.map((c) => c.score || 0);
    return {
      resumes: doneCount,
      avg: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : 0,
      strong: cands.filter((c) => c.band === 'Strong match').length,
      warnings: cands.reduce((a, c) => a + (c.warnings || []).length, 0),
      elapsed,
    };
  })();

  return (
    <div className="studio">
      {/* ---------- progress header ---------- */}
      <section className="card rise studio-top">
        <div className="studio-top-head">
          <div>
            <div className="card-eyebrow">TalentIQ · NLP Processing Studio</div>
            <h2>Analyzing Resume</h2>
            <p className="hint">Extracting skills, processing language, and evaluating job alignment.</p>
          </div>
          <div className="studio-metrics">
            <div className="studio-metric"><span className="sm-k">Progress</span><span className="sm-v mono">{pct}%</span></div>
            <div className="studio-metric"><span className="sm-k">Elapsed</span><span className="sm-v mono">{fmtClock(elapsed)}</span></div>
            <div className="studio-metric"><span className="sm-k">Remaining</span><span className="sm-v mono">{eta != null ? `~${fmtClock(eta)}` : '—'}</span></div>
            <div className="studio-metric"><span className="sm-k">Stage</span><span className="sm-v">{activeLabel}</span></div>
          </div>
        </div>
        <div className="progress-track" role="progressbar" aria-label="Overall screening progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-meta">
          <span>{doneCount} of {total} resumes screened{currentFile ? <> · now reading <strong>{currentFile}</strong></> : ''}</span>
          <span>{batchComplete ? 'Complete' : 'Processing…'}</span>
        </div>
        {error && <div className="alert" role="alert">{error}</div>}
      </section>

      {/* ---------- completion summary ---------- */}
      {batchComplete && showSummary && summaryStats && (
        <section className="card rise studio-done" style={{ '--d': '60ms' }}>
          <div className="card-eyebrow">Complete</div>
          <h2>NLP Analysis Complete</h2>
          <div className="viz-tiles">
            <div className="viz-tile"><div className="viz-tile-k">RESUMES PROCESSED</div><div className="viz-tile-v mono">{summaryStats.resumes}</div></div>
            <div className="viz-tile"><div className="viz-tile-k">AVG MATCH SCORE</div><div className="viz-tile-v mono">{summaryStats.avg}%</div></div>
            <div className="viz-tile"><div className="viz-tile-k">STRONG MATCHES</div><div className="viz-tile-v mono">{summaryStats.strong}</div></div>
            <div className="viz-tile"><div className="viz-tile-k">ELAPSED</div><div className="viz-tile-v mono">{fmtClock(summaryStats.elapsed)}</div></div>
            <div className="viz-tile"><div className="viz-tile-k">WARNINGS</div><div className="viz-tile-v mono">{summaryStats.warnings}</div></div>
          </div>
          <div className="studio-done-actions">
            <Button type="button" className="btn-primary btn-sm" onClick={onViewRanking}>View Candidate Analysis</Button>
            <Button type="button" className="btn-ghost btn-sm" onClick={() => setShowSummary(false)}>Explore NLP Results</Button>
            <Button type="button" className="btn-ghost btn-sm" onClick={onViewRanking}>Return to Candidate Rankings</Button>
          </div>
        </section>
      )}

      {/* ---------- two panels ---------- */}
      <div className="studio-panels">
        {/* LEFT — pipeline execution */}
        <section className="card rise studio-left" style={{ '--d': '100ms' }} aria-label="NLP pipeline execution">
          <div className="card-eyebrow">NLP Processing Pipeline</div>
          <p className="hint">Follow your resume through every stage of intelligent analysis.</p>
          {resumes.length > 1 && (
            <div className="resume-tabs studio-tabs" role="tablist" aria-label="Choose a resume">
              {resumes.map((r) => (
                <Button key={r.key} type="button" role="tab" aria-selected={selected && r.key === selected.key}
                  className={`resume-tab ${r.status} ${selected && r.key === selected.key ? 'active' : ''}`}
                  onClick={() => { setSelResumeKey(r.key); setPinnedStage(null); }} title={r.filename}>
                  <span className={`tab-dot ${r.status}`} />
                  {r.filename.length > 18 ? `${r.filename.slice(0, 16)}…` : r.filename}
                </Button>
              ))}
            </div>
          )}
          <div className="pipe-groups">
            {GROUPS.map((g, gi) => (
              <div className="pipe-group" key={g}>
                <div className="pipe-group-label"><span>GROUP {gi + 1}</span> {g}</div>
                <div className="pipe-list">
                  {STAGES_ENRICHED.filter((s) => s.group === gi).map((s, idx, arr) => {
                    const e = exec[s.execKey] || { status: 'pending' };
                    const st = failed ? 'failed' : toSpec(e.status);
                    const Icon = ICONS[s.icon] || FileText;
                    const isSel = s.n === selStageN;
                    return (
                      <div key={s.n} className="pipe-row-wrap">
                        <Button type="button"
                          className={`pipe-row ${st} ${isSel ? 'selected' : ''}`}
                          onClick={() => setPinnedStage(isSel && pinnedStage ? null : s.n)}
                          aria-current={isSel}
                          title={`${s.name} — ${s.tagline}${s.sub ? ` (runs within ${s.parentName})` : ''}`}>
                          <span className="pipe-rail" aria-hidden="true">
                            <span className={`pipe-dot ${st}`}>{st === 'completed' ? '✓' : st === 'processing' ? <span className="step-spinner xs" /> : s.n}</span>
                            {idx < arr.length - 1 && <span className="pipe-vline" />}
                          </span>
                          <span className="pipe-row-main">
                            <span className="pipe-row-top">
                              <Icon size={14} className="pipe-icon" />
                              <span className="pipe-name">{s.n}. {s.name}</span>
                              {s.sub && <span className="pipe-sub-tag" title={`Runs within ${s.parentName}`}>⊂</span>}
                            </span>
                            <span className="pipe-tagline">{s.tagline}</span>
                          </span>
                          <span className="pipe-row-meta">
                            <span className={`st-badge ${st}`}>{st}</span>
                            {durations[s.execKey] != null && <span className="mono pipe-dur">{fmtDur(durations[s.execKey])}</span>}
                          </span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {pinnedStage && (
            <Button type="button" className="btn-ghost btn-sm studio-live-btn" onClick={() => setPinnedStage(null)}>
              <CheckCircle2 size={14} /> Following live
            </Button>
          )}
        </section>

        {/* RIGHT — stage intelligence */}
        <section className="card rise studio-right" style={{ '--d': '140ms' }} aria-label="Stage intelligence">
          <div className="card-eyebrow">Stage Intelligence</div>
          <p className="hint">Explore the actual transformations performed on your resume.{selected ? <> — <strong>{selected.filename}</strong></> : ''}</p>
          <StageWorkbench
            stage={stage}
            execStatus={specStatus}
            durationMs={durations[stage.execKey]}
            detail={(exec[stage.execKey] || {}).detail}
            ctx={ctx}
          />
        </section>
      </div>
    </div>
  );
}
