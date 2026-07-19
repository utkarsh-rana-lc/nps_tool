import { useEffect, useMemo, useState } from 'react';
import type { Filters, Summary, Timeseries, AccountRow } from './types.js';
import { api, downloadCsv } from './api.js';
import { me, logout, type SessionUser } from './auth.js';
import { FilterBar } from './components/FilterBar.js';
import { SummaryCards } from './components/SummaryCards.js';
import { TrendChart } from './components/TrendChart.js';
import { AccountsTable } from './components/AccountsTable.js';
import { AccountDrawer } from './components/AccountDrawer.js';
import { Login } from './components/Login.js';
import { UsersPanel } from './components/UsersPanel.js';
import { SurveyMessages } from './components/SurveyMessages.js';

function defaultFilters(): Filters {
  const now = new Date();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const fromDate = new Date(now);
  fromDate.setMonth(fromDate.getMonth() - 11);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-01`;
  return { product: 'all', dateFrom: from, dateTo: to };
}

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeseries, setTimeseries] = useState<Timeseries | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [sort, setSort] = useState<'nps' | 'responses' | 'latest'>('nps');
  const [selected, setSelected] = useState<AccountRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore session on load.
  useEffect(() => {
    me().then((u) => { setUser(u); setAuthChecked(true); });
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setError(null);
    Promise.all([
      api.summary(filters),
      api.timeseries(filters, true),
      api.accounts(filters, sort),
    ])
      .then(([s, t, a]) => {
        if (!alive) return;
        setSummary(s);
        setTimeseries(t);
        setAccounts(a.accounts);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [filters, sort, user]);

  const rangeLabel = useMemo(
    () => `${filters.dateFrom.slice(0, 7)} → ${filters.dateTo.slice(0, 7)}`,
    [filters],
  );

  const exportAll = () =>
    downloadCsv(api.exportAllUrl(filters), 'nps_all_accounts.csv');

  if (!authChecked) return <div className="loading" style={{ marginTop: 80 }}>Loading…</div>;
  if (!user) return <Login onLoggedIn={setUser} />;

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>NPS dashboard</h1>
          <div className="sub">LimeChat · CRM · Marketing · Bot — {rangeLabel}</div>
        </div>
        <div className="userbar">
          {user.role === 'admin' && (
            <button className="btn" onClick={() => setShowMessages(true)}>Survey messages</button>
          )}
          {user.role === 'admin' && (
            <button className="btn" onClick={() => setShowUsers(true)}>Manage access</button>
          )}
          <span className="whoami">
            {user.name ?? user.email}
            <span className={`pill ${user.role === 'admin' ? 'good' : 'excellent'}`} style={{ marginLeft: 6 }}>{user.role}</span>
          </span>
          <button className="btn" onClick={() => { logout(); setUser(null); }}>Sign out</button>
        </div>
      </header>

      <FilterBar filters={filters} onChange={setFilters} onExportAll={exportAll} />

      {error && <div className="panel" style={{ color: 'var(--detractor)' }}>Failed to load: {error}</div>}

      {summary && <SummaryCards summary={summary} />}
      {timeseries && <TrendChart data={timeseries} />}

      <div className="panel-head" style={{ margin: '4px 2px 10px' }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Accounts</h2>
      </div>
      <AccountsTable accounts={accounts} onSelect={setSelected} sort={sort} onSort={setSort} />

      {selected && (
        <AccountDrawer account={selected} filters={filters} onClose={() => setSelected(null)} />
      )}

      {showUsers && user.role === 'admin' && (
        <UsersPanel onClose={() => setShowUsers(false)} />
      )}

      {showMessages && user.role === 'admin' && (
        <SurveyMessages onClose={() => setShowMessages(false)} />
      )}
    </div>
  );
}
