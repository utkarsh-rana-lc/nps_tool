import type { Summary } from '../types.js';

const RATING_LABEL: Record<string, string> = {
  world_class: 'World class',
  excellent: 'Excellent',
  good: 'Good',
  needs_attention: 'Needs attention',
};

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`;
}

export function SummaryCards({ summary }: { summary: Summary }) {
  const b = summary.breakdown;
  const deltaClass = summary.delta === null ? '' : summary.delta >= 0 ? 'up' : 'down';
  const deltaSign = summary.delta !== null && summary.delta > 0 ? '+' : '';

  return (
    <div className="grid">
      <div className="card">
        <div className="label">NPS score</div>
        <div className="big">{summary.nps ?? '—'}</div>
        <div className="foot">
          {summary.rating && (
            <span className={`pill ${summary.rating}`}>{RATING_LABEL[summary.rating]}</span>
          )}{' '}
          {summary.delta !== null && (
            <span className={`delta ${deltaClass}`}>
              {deltaSign}
              {summary.delta} vs prev period
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="label">Responses</div>
        <div className="big">{summary.responses.toLocaleString()}</div>
        <div className="foot">
          Response rate {pct(summary.responseRate)} · {summary.prompts.toLocaleString()} prompted
        </div>
      </div>

      <div className="card">
        <div className="label">Mix</div>
        <div className="bar">
          <span className="p" style={{ width: `${b.promoters.pct * 100}%` }} />
          <span className="pa" style={{ width: `${b.passives.pct * 100}%` }} />
          <span className="d" style={{ width: `${b.detractors.pct * 100}%` }} />
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--promoter)' }} />Prom {pct(b.promoters.pct)}</span>
          <span><i style={{ background: 'var(--passive)' }} />Pass {pct(b.passives.pct)}</span>
          <span><i style={{ background: 'var(--detractor)' }} />Detr {pct(b.detractors.pct)}</span>
        </div>
      </div>

      <div className="card">
        <div className="label">Promoters − Detractors</div>
        <div className="big">
          {b.promoters.count}
          <span className="muted" style={{ fontSize: 18 }}> / </span>
          {b.detractors.count}
        </div>
        <div className="foot">{b.passives.count} passives (excluded from NPS)</div>
      </div>
    </div>
  );
}
