import type { AccountRow } from '../types.js';

function npsCell(n: number | null) {
  if (n === null) return <span className="muted">—</span>;
  const cls = n < 0 ? 'detractor' : n < 50 ? 'passive' : 'promoter';
  return <span className={`score-chip ${cls}`}>{n}</span>;
}

export function AccountsTable({
  accounts,
  onSelect,
  sort,
  onSort,
}: {
  accounts: AccountRow[];
  onSelect: (a: AccountRow) => void;
  sort: string;
  onSort: (s: 'nps' | 'responses' | 'latest') => void;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Account</th>
          <th onClick={() => onSort('nps')}>NPS {sort === 'nps' ? '▾' : ''}</th>
          <th>CRM</th>
          <th>Marketing</th>
          <th>Bot</th>
          <th onClick={() => onSort('responses')}>Responses {sort === 'responses' ? '▾' : ''}</th>
          <th onClick={() => onSort('latest')}>Latest {sort === 'latest' ? '▾' : ''}</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((a) => (
          <tr key={a.accountRef} onClick={() => onSelect(a)}>
            <td>
              <div style={{ fontWeight: 600 }}>{a.accountName ?? a.accountRef}</div>
              <div className="muted" style={{ fontSize: 11 }}>{a.accountRef}</div>
            </td>
            <td className="num">{npsCell(a.nps)}</td>
            <td className="num">{npsCell(a.byProduct.crm)}</td>
            <td className="num">{npsCell(a.byProduct.marketing)}</td>
            <td className="num">{npsCell(a.byProduct.bot)}</td>
            <td className="num">{a.responses}</td>
            <td className="num">{a.latestScore ?? '—'}</td>
          </tr>
        ))}
        {accounts.length === 0 && (
          <tr><td colSpan={7} className="loading">No responses match these filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}
