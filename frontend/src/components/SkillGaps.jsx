import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiJson } from '../api';

/**
 * Skill-gap analytics: the required skills most often missing across the
 * candidates of one screening session. Aggregated live from the backend —
 * GET /api/sessions/{id}/skill-gaps.
 */
export default function SkillGaps({ sessionId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    apiJson(`/api/sessions/${sessionId}/skill-gaps`)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData({ gaps: [], total_candidates: 0 }); });
    return () => { alive = false; };
  }, [sessionId]);

  if (!data || !data.gaps || data.gaps.length === 0) return null;
  const rows = data.gaps.slice(0, 12);

  return (
    <section className="card rise" style={{ '--d': '120ms' }}>
      <div className="card-eyebrow">Skill gaps</div>
      <h3>What this batch is missing</h3>
      <p className="hint">
        Required skills most often absent across {data.total_candidates} candidate
        {data.total_candidates !== 1 ? 's' : ''} — useful for seeing where the talent pool falls short.
      </p>
      <div style={{ width: '100%', height: 40 + rows.length * 34, maxHeight: 420 }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted)' }}
              tickLine={false} axisLine={{ stroke: 'var(--line)' }}
              label={{ value: 'candidates missing', position: 'insideBottomRight', offset: -2, fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis type="category" dataKey="skill" width={140} tick={{ fontSize: 12, fill: 'var(--ink-2)', fontWeight: 600 }}
              tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'var(--amber-bg)' }} content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><strong>{payload[0].payload.skill}</strong>{payload[0].value} of {payload[0].payload.total_candidates} candidates missing</div> : null} />
            <Bar dataKey="missing_count" name="candidates missing" fill="var(--amber)"
              radius={[0, 8, 8, 0]} barSize={18}
              background={{ fill: 'var(--surface-2)', radius: 8 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
