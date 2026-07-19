import { useEffect, useState } from 'react';
import type { AccountRow, UserRow, Filters } from '../types.js';
import { api, downloadCsv } from '../api.js';

export function AccountDrawer({
  account,
  filters,
  onClose,
}: {
  account: AccountRow;
  filters: Filters;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<UserRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    api.accountUsers(account.accountRef, filters).then((r) => {
      if (alive) setUsers(r.users);
    });
    return () => {
      alive = false;
    };
  }, [account.accountRef, filters]);

  const download = () =>
    downloadCsv(
      api.exportAccountUrl(account.accountRef, filters),
      `nps_${account.accountRef}.csv`,
    );

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="dh">
          <div>
            <h2>{account.accountName ?? account.accountRef}</h2>
            <div className="muted" style={{ fontSize: 12 }}>{account.accountRef}</div>
          </div>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="card"><div className="label">Account NPS</div><div className="big">{account.nps ?? '—'}</div></div>
          <div className="card"><div className="label">Responses</div><div className="big">{account.responses}</div></div>
          <div className="card"><div className="label">Latest score</div><div className="big">{account.latestScore ?? '—'}</div></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 10px' }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Responses by user</h2>
          <button className="btn primary" onClick={download}>⬇ Download report (CSV)</button>
        </div>

        {users === null ? (
          <div className="loading">Loading…</div>
        ) : (
          <table>
            <thead>
              <tr><th>Email</th><th>Product</th><th>Month</th><th>Score</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} style={{ cursor: 'default' }}>
                  <td>{u.email}</td>
                  <td>{u.product}</td>
                  <td className="num">{u.period}</td>
                  <td className="num"><span className={`score-chip ${u.category}`}>{u.score}</span></td>
                  <td className="reason">{u.reason ?? '—'}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="loading">No responses in range.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
