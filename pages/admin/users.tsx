import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'user' | 'admin';
  is_blocked: boolean;
  email_confirmed_at: string | null;
  created_at: string;
  groupCount: number;
  preferenceCount: number;
  savedFestivalsCount: number;
}

const LIMIT = 50;

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {label}
    </span>
  );
}

export default function AdminUsers() {
  const { session, theme } = useAuth();
  const c = getThemeColors(theme);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputStyle = { background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, borderRadius: 8, padding: '8px 12px', fontSize: 13 };
  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  const fetchUsers = useCallback(async (p: number, s: string, rf: string, bf: string, vf: string) => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (s.trim()) params.set('search', s.trim());
      if (rf) params.set('role', rf);
      if (bf) params.set('is_blocked', bf);
      const res = await fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      let list: AdminUser[] = data.users;
      if (vf === 'verified') list = list.filter((u) => u.email_confirmed_at);
      else if (vf === 'unverified') list = list.filter((u) => !u.email_confirmed_at);
      setUsers(list);
      setTotal(data.total);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(0);
      fetchUsers(0, search, roleFilter, blockedFilter, verifiedFilter);
    }, 300);
  }, [search, roleFilter, blockedFilter, verifiedFilter, fetchUsers]);

  useEffect(() => {
    fetchUsers(page, search, roleFilter, blockedFilter, verifiedFilter);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchUser(id: string, body: object) {
    if (!session?.access_token) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...body } : u)));
      setMessage('Updated successfully');
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteUser(id: string) {
    if (!session?.access_token) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setTotal((t) => t - 1);
      setConfirmDelete(null);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setActionLoading(null);
    }
  }

  function fmt(d: string) {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', color: c.muted, fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${c.brd}`, whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '8px 12px', color: c.txt, fontSize: 13, borderBottom: `1px solid ${c.brd}`, verticalAlign: 'middle' };

  return (
    <AdminLayout title="User Management">
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginBottom: 20 }}>
        <input
          style={{ ...inputStyle, minWidth: 220, flex: 1 }}
          placeholder="Search email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={selectStyle} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}>
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select style={selectStyle} value={blockedFilter} onChange={(e) => { setBlockedFilter(e.target.value); setPage(0); }}>
          <option value="">All Statuses</option>
          <option value="false">Active</option>
          <option value="true">Blocked</option>
        </select>
        <select style={selectStyle} value={verifiedFilter} onChange={(e) => { setVerifiedFilter(e.target.value); setPage(0); }}>
          <option value="">All Verification</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {message && <div style={{ color: c.success, marginBottom: 12, fontSize: 13 }}>{message}</div>}
      {error && <div style={{ color: c.danger, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* Table */}
      <div style={{ background: c.surf, border: `1px solid ${c.brd}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' as const }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: c.surf2 }}>
              <tr>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Verified</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}>Groups</th>
                <th style={thStyle}>Prefs</th>
                <th style={thStyle}>Saved</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} style={{ ...tdStyle, textAlign: 'center', color: c.muted }}>Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={10} style={{ ...tdStyle, textAlign: 'center', color: c.muted }}>No users found</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} style={{ transition: 'background 0.1s' }} onMouseEnter={(e) => (e.currentTarget.style.background = c.surf3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}>{u.email ?? '—'}</td>
                  <td style={tdStyle}>{u.display_name ?? <span style={{ color: c.muted }}>—</span>}</td>
                  <td style={tdStyle}>
                    <button
                      style={{ cursor: 'pointer', border: 'none', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: u.role === 'admin' ? c.accSoft : c.surf2, color: u.role === 'admin' ? c.acc : c.muted, opacity: actionLoading === u.id ? 0.5 : 1 }}
                      onClick={() => patchUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}
                      disabled={actionLoading === u.id}
                      title="Click to toggle role"
                    >
                      {u.role}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    {u.is_blocked
                      ? <Badge label="Blocked" bg={`rgba(239,68,68,0.15)`} color={c.danger} />
                      : <Badge label="Active" bg={`rgba(34,197,94,0.12)`} color={c.success} />}
                  </td>
                  <td style={tdStyle}>
                    {u.email_confirmed_at
                      ? <Badge label="Verified" bg={`rgba(34,197,94,0.12)`} color={c.success} />
                      : <Badge label="Unverified" bg={`rgba(245,158,11,0.15)`} color={c.warning} />}
                  </td>
                  <td style={{ ...tdStyle, color: c.muted }}>{fmt(u.created_at)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const }}>{u.groupCount}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const }}>{u.preferenceCount}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const }}>{u.savedFestivalsCount}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      <button
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${c.brd}`, background: c.surf2, color: c.txt, cursor: 'pointer', opacity: actionLoading === u.id ? 0.5 : 1 }}
                        onClick={() => patchUser(u.id, { is_blocked: !u.is_blocked })}
                        disabled={actionLoading === u.id}
                      >
                        {u.is_blocked ? 'Unblock' : 'Block'}
                      </button>
                      {!u.email_confirmed_at && (
                        <button
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${c.brd}`, background: c.surf2, color: c.acc, cursor: 'pointer', opacity: actionLoading === u.id ? 0.5 : 1 }}
                          onClick={() => patchUser(u.id, { email_confirmed: true })}
                          disabled={actionLoading === u.id}
                        >
                          Verify
                        </button>
                      )}
                      {confirmDelete === u.id ? (
                        <>
                          <button
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: 'none', background: c.danger, color: '#fff', cursor: 'pointer' }}
                            onClick={() => deleteUser(u.id)}
                            disabled={actionLoading === u.id}
                          >
                            Confirm
                          </button>
                          <button
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${c.brd}`, background: c.surf2, color: c.txt, cursor: 'pointer' }}
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${c.danger}`, background: 'transparent', color: c.danger, cursor: 'pointer' }}
                          onClick={() => setConfirmDelete(u.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${c.brd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: c.muted }}>
          <span>{total > 0 ? `Showing ${page * LIMIT + 1}–${Math.min((page + 1) * LIMIT, total)} of ${total}` : 'No results'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${c.brd}`, background: c.surf2, color: c.txt, cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <button
              style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${c.brd}`, background: c.surf2, color: c.txt, cursor: (page + 1) * LIMIT >= total ? 'default' : 'pointer', opacity: (page + 1) * LIMIT >= total ? 0.4 : 1 }}
              disabled={(page + 1) * LIMIT >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
