import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

interface StatsResponse {
  users: {
    total: number;
    newLast7Days: number;
    newLast30Days: number;
    blocked: number;
    recentSignups: Array<{ id: string; email: string | null; display_name: string | null; created_at: string }>;
    mostActive: Array<{ id: string; display_name: string | null; email: string | null; preferenceCount: number }>;
  };
  festivals: { total: number; active: number };
  groups: {
    total: number;
    newLast7Days: number;
    newLast30Days: number;
    blocked: number;
    mostPopular: Array<{ id: number; name: string; festivalName: string; memberCount: number }>;
  };
  performances: { total: number };
  artists: { total: number };
  savedFestivals: { mostSaved: Array<{ id: number; name: string; saveCount: number }> };
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  return (
    <div style={{ background: c.surf, border: `1px solid ${c.brd}`, borderRadius: 12, padding: '20px 24px', minWidth: 140 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? c.txt }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 13, color: c.muted, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: (string | number | null)[][] }) {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  return (
    <div style={{ overflowX: 'auto' as const }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: c.surf2 }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: c.muted, fontWeight: 600, borderBottom: `1px solid ${c.brd}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ padding: '16px 12px', color: c.muted, textAlign: 'center' }}>No data</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${c.brd}` }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '8px 12px', color: c.txt }}>{cell ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  return (
    <div style={{ background: c.surf, border: `1px solid ${c.brd}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${c.brd}`, fontWeight: 600, fontSize: 15, color: c.txt }}>{title}</div>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const { session, theme } = useAuth();
  const c = getThemeColors(theme);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStats(data as StatsResponse);
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false));
  }, [session]);

  function fmt(d: string) {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <AdminLayout title="Dashboard">
      {loading && <div style={{ color: c.muted }}>Loading stats…</div>}
      {error && <div style={{ color: c.danger, marginBottom: 16 }}>{error}</div>}
      {stats && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 16, marginBottom: 32 }}>
            <StatCard label="Total Users" value={stats.users.total} sub={`+${stats.users.newLast7Days} this week`} />
            <StatCard label="Active Festivals" value={stats.festivals.active} sub={`${stats.festivals.total} total`} />
            <StatCard label="Total Groups" value={stats.groups.total} sub={`+${stats.groups.newLast7Days} this week`} />
            <StatCard label="Performances" value={stats.performances.total} />
            <StatCard label="Artists" value={stats.artists.total} />
            <StatCard label="Blocked Users" value={stats.users.blocked} color={stats.users.blocked > 0 ? c.danger : c.muted} />
            <StatCard label="Blocked Groups" value={stats.groups.blocked} color={stats.groups.blocked > 0 ? c.danger : c.muted} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 24 }}>
            <Section title="Most Saved Festivals">
              <SimpleTable
                headers={['Festival', 'Saves']}
                rows={stats.savedFestivals.mostSaved.map((f) => [f.name, f.saveCount])}
              />
            </Section>

            <Section title="Most Popular Groups">
              <SimpleTable
                headers={['Group', 'Festival', 'Members']}
                rows={stats.groups.mostPopular.map((g) => [g.name, g.festivalName, g.memberCount])}
              />
            </Section>

            <Section title="Most Active Users">
              <SimpleTable
                headers={['Name', 'Email', 'Preferences']}
                rows={stats.users.mostActive.map((u) => [u.display_name, u.email, u.preferenceCount])}
              />
            </Section>

            <Section title="Recent Signups">
              <SimpleTable
                headers={['Email', 'Name', 'Joined']}
                rows={stats.users.recentSignups.map((u) => [u.email, u.display_name, fmt(u.created_at)])}
              />
            </Section>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
