const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export const STAGE_ORDER = [
  'step1_ingest',
  'step2_extraction',
  'step3_preprocessing',
  'step4_vectors',
  'step5_matching',
  'step6_transparency',
  'step7_result',
  'step8_feedback',
];

export const STAGE_LABELS = {
  step1_ingest: 'Receiving your file',
  step2_extraction: 'Reading the text',
  step3_preprocessing: 'Finding your skills',
  step4_vectors: 'Comparing with the job',
  step5_matching: 'Scoring the match',
  step6_transparency: 'Explaining the score',
  step7_result: 'Preparing your report',
  step8_feedback: 'Ready for your feedback',
};

export function blankStages() {
  return STAGE_ORDER.map((key) => ({ key, label: STAGE_LABELS[key], status: 'pending', summary: '' }));
}

/**
 * POST /api/screen/stream and parse the SSE event stream.
 * onEvent(evt) is called for every event. Resolves with the batch_complete event.
 * Note: EventSource can't POST multipart bodies, so we use fetch + ReadableStream.
 */
export async function streamScreen(files, job, onEvent) {
  const form = new FormData();
  files.forEach((f) => form.append('resumes', f));
  form.append('job', JSON.stringify(job));
  let res;
  try {
    res = await fetch(`${API_URL}/api/screen/stream`, { method: 'POST', body: form });
  } catch {
    throw new Error('Could not reach the screening service. Please check your connection and try again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || 'Screening failed to start. Please try again.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finished = false;
  while (!finished) {
    const { value, done } = await reader.read();
    finished = done;
    buf += decoder.decode(value || new Uint8Array(), { stream: !finished });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (!chunk.startsWith('data:')) continue;
      let evt;
      try {
        evt = JSON.parse(chunk.slice(5).trim());
      } catch {
        continue;
      }
      onEvent(evt);
      if (evt.type === 'batch_complete') return evt;
    }
  }
  throw new Error('The screening stream ended unexpectedly. Please try again.');
}

export async function setCandidateStatus(resume_id, status, notes = '', reject_reason = '') {
  const res = await fetch(`${API_URL}/api/candidates/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume_id, status, notes, reject_reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || 'Could not save the status.');
  }
  return res.json();
}

export async function getCandidateStatuses() {
  const res = await fetch(`${API_URL}/api/candidates/statuses`);
  if (!res.ok) return {};
  return res.json();
}

export async function sendFeedback(analysis_id, helpful) {
  const res = await fetch(`${API_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysis_id, verdict: helpful ? 'good_fit' : 'bad_fit' }),
  });
  if (!res.ok) throw new Error('Could not save feedback.');
  return res.json();
}

export const API_BASE = API_URL;
