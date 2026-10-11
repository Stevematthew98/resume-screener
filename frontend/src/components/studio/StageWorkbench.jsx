import React, { useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';

const TABS = ['Overview', 'Input / Output', 'Visualization', 'Python Code', 'Technical Details'];

function fmtDur(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function StatusBadge({ status }) {
  return <span className={`st-badge ${status}`}>{status}</span>;
}

/* ---------------- visualization renderers ---------------- */

function Viz({ viz }) {
  if (!viz) return <p className="hint">No visualization for this stage yet.</p>;
  switch (viz.kind) {
    case 'tiles':
      return (
        <div className="viz-tiles">
          {viz.tiles.map(([k, v]) => (
            <div className="viz-tile" key={k}>
              <div className="viz-tile-k">{k}</div>
              <div className="viz-tile-v mono">{v}</div>
            </div>
          ))}
        </div>
      );
    case 'chips':
      return (
        <div>
          {viz.title && <div className="viz-h">{viz.title}</div>}
          {viz.items && viz.items.length ? (
            <div className="chip-row">{viz.items.map((c) => <span className="chip" key={c}>{c}</span>)}</div>
          ) : <p className="hint">{viz.empty || 'Nothing detected.'}</p>}
        </div>
      );
    case 'bars':
      return (
        <div className="viz-bars">
          {viz.bars.map(([label, v]) => {
            const pct = v == null ? 0 : Math.max(0, Math.min(1, Number(v)));
            return (
              <div className="viz-bar-row" key={label}>
                <div className="viz-bar-head"><span>{label}</span><span className="mono">{v == null ? '—' : `${Math.round(pct * 100)}%`}</span></div>
                <div className="viz-bar-track"><div className="viz-bar-fill" style={{ width: `${pct * 100}%` }} /></div>
              </div>
            );
          })}
        </div>
      );
    case 'sections':
      return (
        <div>
          <div className="viz-h">Detected sections{vic_method(viz)}</div>
          {viz.sections && viz.sections.length ? (
            <div className="section-map">
              {viz.sections.map((s) => (
                <div className="section-block" key={s}>
                  <div className="section-name">{s}</div>
                  {viz.previews && viz.previews[s] && (
                    <div className="section-preview">{viz.previews[s].slice(0, 220)}{viz.previews[s].length > 220 ? '…' : ''}</div>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="hint">No sections detected — the whole document is treated as body text.</p>}
        </div>
      );
    case 'list':
      return (
        <div>
          {viz.title && <div className="viz-h">{viz.title}</div>}
          {viz.items && viz.items.length ? (
            <ul className="viz-list">{viz.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
          ) : <p className="hint">{viz.empty || 'Nothing to show yet.'}</p>}
        </div>
      );
    case 'gap':
      return (
        <div className="gap-grid">
          <div>
            <div className="viz-h ok">Matched ({viz.matched.length})</div>
            <div className="chip-row">{viz.matched.map((c) => <span className="chip ok" key={c}>{c}</span>)}</div>
          </div>
          <div>
            <div className="viz-h warn">Not detected ({viz.missing.length})</div>
            <div className="chip-row">{viz.missing.map((c) => <span className="chip warn" key={c}>{c}</span>)}</div>
          </div>
        </div>
      );
    case 'ranking':
      return (
        <div>
          <div className="viz-h">Batch ranking</div>
          {viz.ranking && viz.ranking.length ? (
            <ol className="rank-list">
              {viz.ranking.map((r, i) => (
                <li key={r.resume_id || i} className={r.resume_id === viz.currentId ? 'me' : ''}>
                  <span className="rank-pos mono">#{i + 1}</span>
                  <span className="rank-name">{r.filename || r.name || 'Candidate'}</span>
                  <span className="mono rank-score">{Math.round((r.score || 0) * 100)}%</span>
                </li>
              ))}
            </ol>
          ) : <p className="hint">Ranking assembles when the batch completes.</p>}
        </div>
      );
    case 'note':
      return <p className="viz-note">{viz.text}</p>;
    default:
      return <p className="hint">No visualization for this stage yet.</p>;
  }
}

function vic_method(viz) {
  return viz.method ? <span className="muted"> · via {viz.method}</span> : null;
}

/* ---------------- code explorer ---------------- */

function CodeExplorer({ code }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lines = code.code.split('\n');
  async function copy() {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }
  return (
    <div className="code-explorer">
      <button type="button" className="code-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="code-title">{code.title}</span>
        <span className={`code-src ${/illustrative/i.test(code.note) ? 'demo' : 'real'}`}>
          {/illustrative/i.test(code.note) ? 'illustrative' : 'actual backend'}
        </span>
        <ChevronDown size={16} className={`chev ${open ? 'open' : ''}`} />
      </button>
      <div className="code-meta">
        <span><strong>Library:</strong> {code.library}</span>
        <span><strong>Algorithm:</strong> {code.algorithm}</span>
      </div>
      <p className="hint code-note">{code.note}</p>
      {open && (
        <div className="code-body">
          <button type="button" className="code-copy" onClick={copy} title="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <pre className="code-pre"><code>
            {lines.map((ln, i) => (
              <span className="code-line" key={i}>
                <span className="code-ln">{i + 1}</span>
                <span>{ln || ' '}</span>
              </span>
            ))}
          </code></pre>
        </div>
      )}
    </div>
  );
}

/* ---------------- main workbench ---------------- */

function IoBox({ title, rows, text }) {
  return (
    <div className="io-box">
      <div className="io-title">{title}</div>
      {rows && rows.map(([k, v]) => (
        <div className="drow" key={k}>
          <span className="dkey">{k}</span>
          <span className="dval">{v}</span>
        </div>
      ))}
      {text && <pre className="io-text">{text}</pre>}
    </div>
  );
}

export default function StageWorkbench({ stage, execStatus, durationMs, detail, ctx }) {
  const [tab, setTab] = useState('Overview');
  if (!stage) {
    return (
      <div className="workbench empty">
        <p className="hint">Select a stage on the left to inspect its working.</p>
      </div>
    );
  }
  const io = stage.io(detail, ctx);
  const viz = stage.viz(detail, ctx);

  return (
    <div className="workbench">
      <div className="wb-head">
        <div>
          <div className="wb-eyebrow">Stage {String(stage.n).padStart(2, '0')} · {stage.groupName}</div>
          <h3>{stage.name}</h3>
        </div>
        <div className="wb-badges">
          <StatusBadge status={execStatus} />
          <span className="wb-dur mono" title="Execution duration">{fmtDur(durationMs)}</span>
        </div>
      </div>

      <div className="wb-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t}
            className={`wb-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="wb-body">
        {tab === 'Overview' && (
          <div>
            <p className="wb-purpose">{stage.purpose}</p>
            <div className="io-grid">
              <IoBox title="Input" rows={[['TYPE', stage.inputType]]} />
              <IoBox title="Output" rows={[['TYPE', stage.outputType]]} />
            </div>
            {stage.sub && <p className="hint sub-note">Runs inside “{stage.parentName}” — shares its execution and timing, shown separately for clarity.</p>}
            {execStatus === 'waiting' && <p className="hint">Waiting for the pipeline to reach this stage…</p>}
            {execStatus === 'processing' && <p className="hint">This stage is processing right now — details appear as it completes.</p>}
          </div>
        )}

        {tab === 'Input / Output' && (
          execStatus === 'waiting'
            ? <p className="hint">No data yet — the pipeline hasn’t reached this stage.</p>
            : <div className="io-grid">
              <IoBox title={`Input — ${io.input.title}`} rows={io.input.rows} text={io.input.text} />
              <IoBox title={`Output — ${io.output.title}`} rows={io.output.rows} text={io.output.text} />
            </div>
        )}

        {tab === 'Visualization' && <Viz viz={viz} />}

        {tab === 'Python Code' && <CodeExplorer code={stage.code} />}

        {tab === 'Technical Details' && (
          <ul className="viz-list">
            <li><strong>Backend stage:</strong> <span className="mono">{stage.execKey}</span>{stage.sub ? ' (shared execution)' : ''}</li>
            {stage.tech.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
