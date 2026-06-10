import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface AdminGroup {
  id: number;
  name: string;
  invite_code: string;
  created_at: string;
  is_blocked: boolean;
  festivalName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
}

interface GroupMember {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: string;
  joinedAt: string;
  preferenceCount: number;
}

const LIMIT = 50;

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {label}
    </span>
  );
}

export default function AdminGroups() {
  const { session, theme } = useAuth();
  const c = getThemeColors(theme);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [membersGroupId, setMembersGroupId] = useState<number | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputStyle = { background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, borderRadius: 8, padding: '8px 12px', fontSize: 13 };
  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  const fetchGroups = useCallback(async (p: number, s: string, bf: string) => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (s.trim()) params.set('search', s.trim());
      if (bf) params.set('is_blocked', bf);
      const res = await fetch(`/api/admin/groups?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch groups');
      setGroups(data.groups);
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
      fetchGroups(0, search, blockedFilter);
    }, 300);
  }, [search, blockedFilter, fetchGroups]);

  useEffect(() => {
    fetchGroups(page, search, blockedFilter);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchGroup(id: number, body: object) {
    if (!session?.access_token) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update group');
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...body } : g)));
      setMessage('Updated successfully');
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteGroup(id: number) {
    if (!session?.access_token) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete group');
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setTotal((t) => t - 1);
      setConfirmDelete(null);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setActionLoading(null);
    }
  }

  async function loadMembers(id: number) {
    if (!session?.access_token) return;
    if (membersGroupId === id) { setMembersGroupId(null); return; }
    setMembersGroupId(id);
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/admin/groups/${id}/members`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers(data.members);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setMembersLoading(false);
    }
  }

  function fmt(d: string) {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', color: c.muted, fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${c.brd}`, whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '8px 12px', color: c.txt, fontSize: 13, borderBottom: `1px solid ${c.brd}`, verticalAlign: 'middle' };

  return (
    <AdminLayout title="Group Management">
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginBottom: 20 }}>
        <input
          style={{ ...inputStyle, minWidth: 220, flex: 1 }}
          placeholder="Search group name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select data-testid="groups-blocked-filter" style={selectStyle} value={blockedFilter} onChange={(e) => { setBlockedFilter(e.target.value); setPage(0); }}>
          <option value="">All Statuses</option>
          <option value="false">Active</option>
          <option value="true">Blocked</option>
        </select>
      </div>

      {message && <div style={{ color: c.success, marginBottom: 12, fontSize: 13 }}>{message}</div>}
      {error && <div style={{ color: c.danger, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* Table */}
      <div style={{ background: c.surf, border: `1px solid ${c.brd}`, borderRadius: 12, overflow: 'hidden', marginBottom: 0 }}>
        <div style={{ overflowX: 'auto' as const }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: c.surf2 }}>
              <tr>
                <th style={thStyle}>Group Name</th>
                <th style={thStyle}>Festival</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Members</th>
                <th style={thStyle}>Invite Code</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: c.muted }}>Loading…</td></tr>
              )}
              {!loading && groups.length === 0 && (
                <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: c.muted }}>No groups found</td></tr>
              )}
              {groups.map((g) => (
                <>
                  <tr key={g.id} style={{ transition: 'background 0.1s' }} onMouseEnter={(e) => (e.currentTarget.style.background = c.surf3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{g.name}</td>
                    <td style={{ ...tdStyle, color: c.muted }}>{g.festivalName ?? '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 12 }}>{g.ownerName ?? <span style={{ color: c.muted }}>—</span>}</div>
                      {g.ownerEmail && <div style={{ fontSize: 11, color: c.muted }}>{g.ownerEmail}</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>{g.memberCount}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: c.muted }}>{g.invite_code}</td>
                    <td style={{ ...tdStyle, color: c.muted }}>{fmt(g.created_at)}</td>
                    <td style={tdStyle}>
                      {g.is_blocked
                        ? <Badge label="Blocked" bg="rgba(239,68,68,0.15)" color={c.danger} />
                        : <Badge label="Active" bg="rgba(34,197,94,0.12)" color={c.success} />}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                        <button
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${c.brd}`, background: membersGroupId === g.id ? c.accSoft : c.surf2, color: membersGroupId === g.id ? c.acc : c.txt, cursor: 'pointer' }}
                          onClick={() => loadMembers(g.id)}
                        >
                          {membersGroupId === g.id ? 'Hide Members' : 'Members'}
                        </button>
                        <button
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${c.brd}`, background: c.surf2, color: c.txt, cursor: 'pointer', opacity: actionLoading === g.id ? 0.5 : 1 }}
                          onClick={() => patchGroup(g.id, { is_blocked: !g.is_blocked })}
                          disabled={actionLoading === g.id}
                        >
                          {g.is_blocked ? 'Unblock' : 'Block'}
                        </button>
                        {confirmDelete === g.id ? (
                          <>
                            <button
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: 'none', background: c.danger, color: '#fff', cursor: 'pointer' }}
                              onClick={() => deleteGroup(g.id)}
                              disabled={actionLoading === g.id}
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
                            onClick={() => setConfirmDelete(g.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {membersGroupId === g.id && (
                    <tr key={`${g.id}-members`}>
                      <td colSpan={8} style={{ padding: 0, background: c.surf2, borderBottom: `1px solid ${c.brd}` }}>
                        <div style={{ padding: '12px 20px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: c.txt, marginBottom: 10 }}>Members of &quot;{g.name}&quot;</div>
                          {membersLoading ? (
                            <div style={{ color: c.muted, fontSize: 13 }}>Loading members…</div>
                          ) : members.length === 0 ? (
                            <div style={{ color: c.muted, fontSize: 13 }}>No members</div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr>
                                  {['Name', 'Email', 'Role', 'Joined', 'Preferences'].map((h) => (
                                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: c.muted, fontWeight: 600, borderBottom: `1px solid ${c.brd}` }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {members.map((m) => (
                                  <tr key={m.userId}>
                                    <td style={{ padding: '6px 10px', color: c.txt }}>{m.displayName ?? '—'}</td>
                                    <td style={{ padding: '6px 10px', color: c.muted }}>{m.email ?? '—'}</td>
                                    <td style={{ padding: '6px 10px' }}>
                                      <Badge
                                        label={m.role}
                                        bg={m.role === 'owner' ? c.accSoft : c.surf}
                                        color={m.role === 'owner' ? c.acc : c.muted}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 10px', color: c.muted }}>{fmt(m.joinedAt)}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', color: c.txt }}>{m.preferenceCount}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
