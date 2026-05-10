import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors, type ThemeMode } from '@/lib/platform';

interface UserGroup {
  id: number;
  name: string;
  invite_code: string;
  festival_id: number;
  created_at: string;
  member_role: 'owner' | 'member';
  festival_name: string;
  festival_year: number;
  festival_emoji: string;
  festival_color: string;
  member_count: number;
}

export default function GroupsPage() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [theme] = useState<ThemeMode>('dark');

  const c = getThemeColors(theme);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const loadGroups = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: membershipRows, error: membershipError } = await supabase
          .from('group_members')
          .select('group_id, role')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (membershipError) throw membershipError;

        const memberships = membershipRows || [];
        if (memberships.length === 0) {
          setGroups([]);
          return;
        }

        const groupIds = memberships.map((membership) => membership.group_id);
        const roleByGroupId = Object.fromEntries(
          memberships.map((membership) => [membership.group_id, membership.role])
        ) as Record<number, 'owner' | 'member'>;

        const { data: groupRows, error: groupsError } = await supabase
          .from('groups')
          .select('id, name, invite_code, festival_id, created_at, festivals(id, name, year, emoji, color)')
          .in('id', groupIds)
          .order('created_at', { ascending: false });

        if (groupsError) throw groupsError;

        const { data: memberCountRows, error: memberCountError } = await supabase
          .from('group_members')
          .select('group_id')
          .in('group_id', groupIds);

        if (memberCountError) throw memberCountError;

        const countByGroupId = (memberCountRows || []).reduce<Record<number, number>>((acc, row) => {
          acc[row.group_id] = (acc[row.group_id] || 0) + 1;
          return acc;
        }, {});

        const mappedGroups: UserGroup[] = (groupRows || []).map((group: any) => ({
          id: group.id,
          name: group.name,
          invite_code: group.invite_code,
          festival_id: group.festival_id,
          created_at: group.created_at,
          member_role: roleByGroupId[group.id] || 'member',
          festival_name: group.festivals?.name || 'Festival',
          festival_year: group.festivals?.year || new Date(group.created_at).getFullYear(),
          festival_emoji: group.festivals?.emoji || '🎪',
          festival_color: group.festivals?.color || '#e85d26',
          member_count: countByGroupId[group.id] || 0
        }));

        setGroups(mappedGroups);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load your groups.');
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, [router, supabase, user]);

  const copyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(null), 1600);
  };

  const shareToWhatsApp = (group: UserGroup) => {
    const message = `Join my Lineup-Mate group "${group.name}" for ${group.festival_name}. Invite code: ${group.invite_code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-6xl px-4 py-8">
          <header className="mb-6 rounded-[28px] p-6 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>Lineup·Mate</p>
                <h1 className="text-4xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>My Groups</h1>
                <p className="mt-2 text-sm" style={{ color: c.muted }}>
                  See all groups you created or joined, share invite codes, and open the group schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="rounded-full px-4 py-2 text-sm font-black"
                style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
              >
                Browse Festivals
              </button>
            </div>
          </header>

          {loading && <p style={{ color: c.muted }}>Loading groups…</p>}
          {error && <p className="mb-4 rounded-xl p-4 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>{error}</p>}

          {!loading && groups.length === 0 && !error && (
            <div className="rounded-[28px] p-8 text-center" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <div className="text-5xl">👥</div>
              <h2 className="mt-3 text-2xl font-black">No groups yet</h2>
              <p className="mt-2 text-sm" style={{ color: c.muted }}>
                Open a festival, create a group, or join one with an invite code.
              </p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="mt-5 rounded-full px-5 py-3 text-sm font-black text-white"
                style={{ background: `linear-gradient(135deg, ${c.acc}, ${c.accB})` }}
              >
                Find a Festival
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {groups.map((group) => (
              <article key={group.id} className="overflow-hidden rounded-[28px] shadow-xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <div className="h-2" style={{ background: group.festival_color }} />
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ background: `${group.festival_color}22` }}>
                        {group.festival_emoji}
                      </div>
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: group.festival_color }}>
                          {group.festival_name} {group.festival_year}
                        </p>
                        <h2 className="text-xl font-black">{group.name}</h2>
                      </div>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-black capitalize" style={{ background: c.surf2, color: c.muted, border: `1px solid ${c.brd}` }}>
                      {group.member_role}
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl p-3" style={{ background: c.surf2 }}>
                      <b className="block text-lg" style={{ color: c.txt }}>{group.member_count}</b>
                      <span style={{ color: c.muted }}>members</span>
                    </div>
                    <div className="rounded-2xl p-3" style={{ background: c.surf2 }}>
                      <b className="block text-lg" style={{ color: c.txt }}>{new Date(group.created_at).toLocaleDateString()}</b>
                      <span style={{ color: c.muted }}>created</span>
                    </div>
                  </div>

                  <div className="mb-4 rounded-2xl p-3" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                    <div className="mb-1 text-xs font-black uppercase tracking-widest" style={{ color: c.muted }}>Invite code</div>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate text-sm font-black" style={{ color: c.txt }}>{group.invite_code}</code>
                      <button
                        type="button"
                        onClick={() => copyInviteCode(group.invite_code)}
                        className="rounded-full px-3 py-1 text-xs font-black text-white"
                        style={{ background: copiedCode === group.invite_code ? '#18a87a' : c.accB }}
                      >
                        {copiedCode === group.invite_code ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/group/${group.id}`)}
                      className="rounded-full px-4 py-2 text-sm font-black text-white"
                      style={{ background: group.festival_color }}
                    >
                      Open Group Schedule
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/festival/${group.festival_id}`)}
                      className="rounded-full px-4 py-2 text-sm font-black"
                      style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                    >
                      Open Festival
                    </button>
                    <button
                      type="button"
                      onClick={() => shareToWhatsApp(group)}
                      className="rounded-full px-4 py-2 text-sm font-black"
                      style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                    >
                      Share WhatsApp
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
