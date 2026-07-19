import { useEffect, useState } from 'react';
import { api, type DashboardUserRow } from '../api.js';

export function UsersPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<DashboardUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // new-user form
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [busy, setBusy] = useState(false);

  const reload = () => api.listUsers().then((r) => setUsers(r.users)).catch((e) => setError(String(e)));
  useEffect(() => { void reload(); }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createUser({ email, name, password, role });
      setEmail(''); setName(''); setPassword(''); setRole('viewer');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: DashboardUserRow) {
    await api.updateUser(u.id, { isActive: !u.is_active });
    await reload();
  }
  async function changeRole(u: DashboardUserRow, r: 'admin' | 'viewer') {
    await api.updateUser(u.id, { role: r });
    await reload();
  }
  async function resetPw(u: DashboardUserRow) {
    const pw = prompt(`New password for ${u.email} (min 10 chars):`);
    if (pw) { await api.updateUser(u.id, { password: pw }); alert('Password updated.'); }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" style={{ width: 680 }}>
        <div className="dh">
          <div><h2>Dashboard access</h2><div className="muted" style={{ fontSize: 12 }}>Manage who can sign in and what they can do</div></div>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <form className="panel" onSubmit={addUser}>
          <h2 style={{ fontSize: 14, marginBottom: 10 }}>Invite a team member</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="fld">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="fld">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="fld">Temp password<input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 10 chars" required /></label>
            <label className="fld">Role
              <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'viewer')}>
                <option value="viewer">Viewer — read-only</option>
                <option value="admin">Admin — can manage users</option>
              </select>
            </label>
          </div>
          {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
          <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 12 }}>
            {busy ? 'Adding…' : 'Add user'}
          </button>
        </form>

        {users === null ? (
          <div className="loading">Loading…</div>
        ) : (
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ cursor: 'default' }}>
                  <td><div style={{ fontWeight: 600 }}>{u.name ?? u.email}</div><div className="muted" style={{ fontSize: 11 }}>{u.email}</div></td>
                  <td>
                    <select value={u.role} onChange={(e) => changeRole(u, e.target.value as 'admin' | 'viewer')}>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>{u.is_active ? <span className="pill good">Active</span> : <span className="pill needs_attention">Disabled</span>}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn" onClick={() => toggleActive(u)}>{u.is_active ? 'Disable' : 'Enable'}</button>{' '}
                    <button className="btn" onClick={() => resetPw(u)}>Reset pw</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
