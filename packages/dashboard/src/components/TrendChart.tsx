import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { Timeseries } from '../types.js';

const COLORS = {
  overall: '#16202c',
  crm: '#1fa97a',
  marketing: '#e0a500',
  bot: '#3a6df0',
};

/** Merge per-product series into rows keyed by period, for a multi-line chart. */
function mergeByProduct(ts: Timeseries) {
  const periods = new Set<string>();
  ts.points.forEach((p) => periods.add(p.period));
  Object.values(ts.byProduct ?? {}).forEach((arr) =>
    arr.forEach((p) => periods.add(p.period)),
  );
  const sorted = [...periods].sort();
  const idx = (arr: { period: string; nps: number | null }[]) =>
    Object.fromEntries(arr.map((p) => [p.period, p.nps]));
  const overall = idx(ts.points);
  const crm = idx(ts.byProduct?.crm ?? []);
  const marketing = idx(ts.byProduct?.marketing ?? []);
  const bot = idx(ts.byProduct?.bot ?? []);
  return sorted.map((period) => ({
    period,
    overall: overall[period] ?? null,
    crm: crm[period] ?? null,
    marketing: marketing[period] ?? null,
    bot: bot[period] ?? null,
  }));
}

export function TrendChart({ data }: { data: Timeseries }) {
  const [split, setSplit] = useState(false);
  const rows = split
    ? mergeByProduct(data)
    : data.points.map((p) => ({ period: p.period, overall: p.nps }));

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>NPS trend</h2>
          <span className="muted" style={{ fontSize: 12 }}>Monthly, {rows.length} periods</span>
        </div>
        <div className="seg">
          <button className={!split ? 'active' : ''} onClick={() => setSplit(false)}>Overall</button>
          <button className={split ? 'active' : ''} onClick={() => setSplit(true)}>By product</button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6b7787' }} interval="preserveStartEnd" />
          <YAxis domain={[-100, 100]} tick={{ fontSize: 11, fill: '#6b7787' }} />
          <Tooltip />
          <ReferenceLine y={0} stroke="#c4ccd6" />
          {split ? (
            <>
              <Legend />
              <Line type="monotone" dataKey="crm" name="CRM" stroke={COLORS.crm} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="marketing" name="Marketing" stroke={COLORS.marketing} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="bot" name="Bot" stroke={COLORS.bot} strokeWidth={2} dot={false} connectNulls />
            </>
          ) : (
            <Line type="monotone" dataKey="overall" name="NPS" stroke={COLORS.overall} strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
