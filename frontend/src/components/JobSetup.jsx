import React, { useRef, useState } from 'react';

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </label>
  );
}

/**
 * Step 1 of the recruiter flow: structured job setup + batch resume upload.
 */
export default function JobSetup({ job, setJob, files, setFiles, onScreen, error }) {
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);

  function set(k, v) {
    setJob((j) => ({ ...j, [k]: v }));
  }

  function addFiles(list) {
    const incoming = Array.from(list || []).filter((f) => /\.(pdf|docx?|doc)$/i.test(f.name));
    if (!incoming.length) return;
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size));
      const merged = [...prev];
      for (const f of incoming) {
        if (!names.has(f.name + f.size)) merged.push(f);
      }
      return merged.slice(0, 20);
    });
  }

  function removeFile(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalKB = files.reduce((a, f) => a + f.size, 0) / 1024;

  return (
    <div className="setup-grid">
      <section className="card rise" style={{ '--d': '0ms' }}>
        <div className="card-eyebrow">Job setup</div>
        <h2>Describe the role</h2>
        <p className="hint">The screener compares every resume against this. The more specific the skills, the sharper the ranking.</p>

        <div className="form-row">
          <Field label="Job title">
            <input type="text" value={job.title} onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Senior Backend Engineer" />
          </Field>
          <Field label="Company">
            <input type="text" value={job.company} onChange={(e) => set('company', e.target.value)}
              placeholder="e.g. Acme Technologies" />
          </Field>
        </div>

        <Field label="Job description" hint="Paste the full posting — responsibilities, must-haves, nice-to-haves.">
          <textarea rows={7} value={job.jdText} onChange={(e) => set('jdText', e.target.value)}
            placeholder="We are hiring a Senior Backend Engineer to build payment microservices. Must have: Python, Django, PostgreSQL, Docker…" />
        </Field>

        <Field label="Required skills" hint="Comma-separated. These carry half of the score.">
          <input type="text" value={job.requiredSkills} onChange={(e) => set('requiredSkills', e.target.value)}
            placeholder="e.g. Python, Django, PostgreSQL, Docker, REST APIs" />
        </Field>

        <Field label="Preferred skills (optional)" hint="Nice-to-haves — shown in each candidate's report, not scored.">
          <input type="text" value={job.preferredSkills} onChange={(e) => set('preferredSkills', e.target.value)}
            placeholder="e.g. Kubernetes, Redis, AWS" />
        </Field>

        <div className="form-row">
          <Field label="Minimum experience (years)">
            <input type="number" min="0" step="0.5" value={job.minExp}
              onChange={(e) => set('minExp', e.target.value)} placeholder="e.g. 3" />
          </Field>
          <Field label="Education requirements (optional)" hint="Comma-separated degree keywords.">
            <input type="text" value={job.eduReq} onChange={(e) => set('eduReq', e.target.value)}
              placeholder="e.g. B.Tech, MCA" />
          </Field>
        </div>
      </section>

      <section className="card rise" style={{ '--d': '80ms' }}>
        <div className="card-eyebrow">Resumes</div>
        <h2>Upload resumes</h2>
        <p className="hint">Add one resume — or a whole batch. Each file runs through the full screening pipeline.</p>

        <div
          className={`dropzone ${dragOver ? 'over' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        >
          <input ref={fileInput} type="file" accept=".pdf,.docx,.doc" multiple hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <div className="dz-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15l3-3 3 3" />
            </svg>
          </div>
          <div className="dz-text"><strong>Drop resumes here</strong> or click to browse</div>
          <div className="dz-sub">PDF or Word · up to 10 MB each · max 20 files</div>
        </div>

        {files.length > 0 && (
          <div className="file-list">
            {files.map((f, i) => (
              <div key={f.name + f.size} className="file-row">
                <span className="file-badge">{f.name.split('.').pop().toUpperCase()}</span>
                <span className="file-name">{f.name}</span>
                <span className="file-size">{(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" className="file-remove" onClick={() => removeFile(i)} aria-label="Remove file">✕</button>
              </div>
            ))}
            <div className="file-total">{files.length} file{files.length > 1 ? 's' : ''} · {totalKB.toFixed(0)} KB total</div>
          </div>
        )}

        {error && <div className="alert">{error}</div>}

        <button className="cta" type="button" onClick={onScreen} disabled={files.length === 0}>
          Screen {files.length > 0 ? `${files.length} resume${files.length > 1 ? 's' : ''}` : 'resumes'} →
        </button>
        <p className="cta-hint">You will watch each resume being analysed, then get a ranked shortlist.</p>
      </section>
    </div>
  );
}
