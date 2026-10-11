import Button from './Button';
import React, { Fragment, useState } from 'react';

/**
 * Screening view, split into two parts:
 *  Part 1 — Live pipeline: an animated stepper showing the 8 stages being
 *            accomplished one by one for the selected resume.
 *  Part 2 — Stage details: every stage opened up, showing what it actually
 *            found — all values come from the real per-stage outputs
 *            streamed by the backend. Nothing is fabricated.
 */

// Short technical names for the stepper, keyed by pipeline stage key.
const STEP_NAMES = {
  step1_ingest: 'INGEST',
  step2_extraction: 'EXTRACT',
  step3_preprocessing: 'PREPROCESS',
  step4_vectors: 'VECTORIZE',
  step5_matching: 'MATCH',
  step6_transparency: 'SCORE',
  step7_result: 'EXPLAIN',
  step8_feedback: 'RANK',
};

function fmtInt(v) {
  return v == null || v === '' ? '—' : Number(v).toLocaleString();
}
function fmtPct(v) {
  return v == null || v === '' ? '—' : `${Math.round(Number(v) * 100)}%`;
}
function fmtDec(v) {
  return v == null || v === '' ? '—' : Number(v).toFixed(4);
}
function fmtKb(bytes) {
  return bytes == null ? '—' : `${Math.round(Number(bytes) / 1024).toLocaleString()} KB`;
}
function shortModel(name) {
  if (!name) return '—';
  return String(name).replace('sentence-transformers/', '').replace('scikit-learn ', '');
}

function Chips({ items, limit = 8 }) {
  if (!items || !items.length) return <span className="dval dim">none detected</span>;
  const shown = items.slice(0, limit);
  return (
    <span className="chip-row">
      {shown.map((c) => <span className="chip" key={c}>{c}</span>)}
      {items.length > limit && <span className="chip more">+{items.length - limit} more</span>}
    </span>
  );
}

function Row({ k, children }) {
  return (
    <div className="drow">
      <span className="dkey">{k}</span>
      <span className="dval">{children}</span>
    </div>
  );
}

/** Curated, real per-stage outputs — only fields the backend actually emits. */
function DetailRows({ stage }) {
  const d = stage.detail;
  if (!d) return null;
  switch (stage.key) {
    case 'step1_ingest':
      return (
        <>
          <Row k="FILE_TYPE">{String(d.file_type || '—').toUpperCase()}</Row>
          <Row k="FILE_SIZE">{fmtKb(d.file_size_bytes)}</Row>
          <Row k="JD_CHARS">{fmtInt(d.job_description_chars)}</Row>
          <Row k="MIN_EXP_YRS">{d.min_experience_years ?? '—'}</Row>
        </>
      );
    case 'step2_extraction':
      return (
        <>
          <Row k="METHOD">{d.extraction_method || '—'}</Row>
          <Row k="OCR_USED">{d.ocr_used ? 'Yes — scanned pages' : 'No — digital text'}</Row>
          <Row k="WORDS">{fmtInt(d.words_extracted)}</Row>
          <Row k="CHARS">{fmtInt(d.chars_extracted)}</Row>
          <Row k="SECTIONS"><Chips items={d.sections_found} /></Row>
        </>
      );
    case 'step3_preprocessing':
      return (
        <>
          <Row k="TOKENS">{fmtInt(d.tokens_after_preprocessing)}</Row>
          <Row k="UNIQUE_LEMMAS">{fmtInt(d.unique_lemmas)}</Row>
        </>
      );
    case 'step4_vectors':
      return (
        <>
          <Row k="EMBED_MODEL">{shortModel(d.embedding_model)}</Row>
          <Row k="TFIDF_MODEL">{shortModel(d.tfidf_model)}</Row>
          <Row k="COS_FULL_JD">{fmtDec(d.cosine_full_vs_jd)}</Row>
          <Row k="COS_SKILLS_JD">{fmtDec(d.cosine_skills_vs_jd)}</Row>
          <Row k="COS_EXP_JD">{fmtDec(d.cosine_experience_vs_jd)}</Row>
          <Row k="TFIDF_COS">{fmtDec(d.tfidf_cosine)}</Row>
        </>
      );
    case 'step5_matching':
      return (
        <>
          <Row k="SKILLS_FOUND">{fmtInt(d.skills_count)}</Row>
          <Row k="OVERLAP">{fmtPct(d.skill_overlap_ratio)}</Row>
          <Row k="MATCHED"><Chips items={d.matched_skills} /></Row>
          <Row k="MISSING"><Chips items={d.missing_skills} /></Row>
          <Row k="EXP_YEARS">{d.experience_years ?? '—'}</Row>
          <Row k="DEGREES"><Chips items={d.degrees} /></Row>
        </>
      );
    case 'step6_transparency':
      return (
        <>
          {d.score_breakdown && typeof d.score_breakdown === 'object' && Object.entries(d.score_breakdown).map(([k, v]) => (
            <Row key={k} k={k.toUpperCase().replace(/_/g, ' ')}>
              {typeof v === 'number' && v <= 1 ? fmtPct(v) : String(v)}
            </Row>
          ))}
          <Row k="WARNINGS">{d.warnings && d.warnings.length ? <Chips items={d.warnings} limit={4} /> : 'none'}</Row>
        </>
      );
    case 'step7_result':
      return (
        <>
          <Row k="FINAL_SCORE"><strong className="mono">{fmtPct(d.final_score ?? d.score)}</strong></Row>
          <Row k="BAND">{d.band || '—'}</Row>
          {d.band_note && <Row k="NOTE">{d.band_note}</Row>}
        </>
      );
    case 'step8_feedback':
      return (
        <>
          <Row k="ENDPOINT">{d.feedback_endpoint || '—'}</Row>
          <Row k="RECORDED_AT">{d.created_at ? new Date(d.created_at).toLocaleString() : '—'}</Row>
        </>
      );
    default:
      return null;
  }
}

function Stepper({ stages }) {
  const activeIdx = stages.findIndex((s) => s.status === 'active');
  const doneCount = stages.filter((s) => s.status === 'done').length;
  return (
    <div>
      <div className="stepper" role="list" aria-label="Pipeline progress">
        {stages.map((s, i) => (
          <Fragment key={s.key}>
            {i > 0 && (
              <div className={`step-link ${stages[i - 1].status === 'done' ? 'filled' : s.status === 'active' ? 'live' : ''}`} aria-hidden="true">
                <div className="step-link-fill" />
              </div>
            )}
            <div className={`step-node ${s.status}`} role="listitem" title={s.label}>
              <div className="step-node-dot">
                {s.status === 'done' ? <span className="step-check">✓</span>
                  : s.status === 'active' ? <span className="step-spinner" />
                    : <span>{i + 1}</span>}
              </div>
              <div className="step-node-label">{STEP_NAMES[s.key] || s.label}</div>
            </div>
          </Fragment>
        ))}
      </div>
      <p className="stepper-status">
        {doneCount === stages.length
          ? <><strong>Complete</strong> — all 8 stages finished for this resume.</>
          : activeIdx >= 0
            ? <>Stage <strong>{activeIdx + 1} of 8</strong> · {stages[activeIdx].label}…</>
            : <>Waiting to start — {doneCount}/8 stages done.</>}
      </p>
    </div>
  );
}

export default function ScreeningView({ total, doneCount, currentFile, resumes, error }) {
  const [manualKey, setManualKey] = useState(null);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const running = resumes.find((r) => r.status === 'running');
  const selected = (manualKey && resumes.find((r) => r.key === manualKey)) || running || resumes[0];

  return (
    <div>
      <section className="card rise">
        <div className="card-eyebrow">Screening in progress</div>
        <h2>{doneCount < total ? `Analysing resume ${Math.min(doneCount + 1, total)} of ${total}…` : 'Finishing up…'}</h2>
        <p className="hint">
          {currentFile ? <>Now reading: <strong>{currentFile}</strong></> : 'Starting the pipeline…'}
        </p>
        <div className="progress-track" role="progressbar" aria-label="Batch screening progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-meta">
          <span>{doneCount} of {total} resumes screened</span>
          <span>{pct}%</span>
        </div>
        {error && <div className="alert" role="alert">{error}</div>}
      </section>

      {/* PART 1 — how the process is being accomplished, step by step */}
      <section className="card rise" style={{ '--d': '80ms', marginTop: 16 }}>
        <div className="card-eyebrow">Part 1 · Live pipeline</div>
        <h2>Watching the process happen</h2>
        <p className="hint">Each node lights up as its stage completes — the working pipeline, one step at a time.</p>
        {resumes.length > 1 && (
          <div className="resume-tabs" role="tablist" aria-label="Choose a resume to inspect">
            {resumes.map((r) => (
              <Button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={selected && r.key === selected.key}
                className={`resume-tab ${r.status} ${selected && r.key === selected.key ? 'active' : ''}`}
                onClick={() => setManualKey(r.key)}
                title={r.filename}
              >
                <span className={`tab-dot ${r.status}`} />
                {r.filename.length > 22 ? `${r.filename.slice(0, 20)}…` : r.filename}
              </Button>
            ))}
          </div>
        )}
        {selected ? (
          <Stepper stages={selected.stages} />
        ) : (
          <p className="hint">No resumes in this batch yet.</p>
        )}
      </section>

      {/* PART 2 — every step in detail */}
      <section className="rise" style={{ '--d': '140ms', marginTop: 16 }}>
        <div className="card-eyebrow">Part 2 · Stage details</div>
        <h2>What each stage found{selected ? <> — <span className="muted">{selected.filename}</span></> : ''}</h2>
        <p className="hint">Every value below is a real output from that stage. Pending stages fill in as the pipeline reaches them.</p>
        {selected ? (
          <div className="stage-detail-grid">
            {selected.stages.map((s, i) => (
              <div key={s.key} className={`card stage-detail-card ${s.status}`}>
                <div className="stage-detail-head">
                  <span className="stage-detail-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="stage-detail-title">{s.label}</span>
                  <span className={`stage-badge ${s.status}`}>
                    {s.status === 'done' ? 'done' : s.status === 'active' ? 'working' : 'pending'}
                  </span>
                </div>
                {s.status === 'done' ? (
                  <>
                    {s.summary && <p className="stage-summary">{s.summary}</p>}
                    <div className="detail-rows"><DetailRows stage={s} /></div>
                  </>
                ) : s.status === 'active' ? (
                  <p className="hint"><span className="step-spinner inline" /> This stage is working right now…</p>
                ) : (
                  <p className="hint">Not reached yet — details appear when the pipeline gets here.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">No resumes in this batch yet.</p>
        )}
      </section>

      <p className="screen-note">
        Each resume goes through the same 8-step analysis: reading the text, finding skills,
        comparing meaning with the job, scoring, and explaining the result. Nothing is skipped, nothing is faked.
      </p>
    </div>
  );
}
