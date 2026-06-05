import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { formatDateRange, getThemeColors } from '@/lib/platform';

interface FestivalOption {
  id: number;
  name: string;
  year: number;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  emoji: string | null;
  color: string | null;
}

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
  festival_location: string | null;
  festival_start_date: string | null;
  festival_end_date: string | null;
  member_count: number;
}

export default function GroupsPage() {
  const router = useRouter();
  const { user, authReady, supabase, theme } = useAuth();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [festivals, setFestivals] = useState<FestivalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedFestivalId, setSelectedFestivalId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const c = getThemeColors(theme);

  const saveFestivalForUser = async (festivalId: number) => {
    if (!user || !festivalId) return;

    const { error: saveError } = await supabase
      .from('saved_festivals')
      .upsert({ user_id: user.id, festival_id: festivalId }, { onConflict: 'user_id,festival_id' });

    if (saveError) throw saveError;
  };

  const loadGroups = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data: membershipRows, error: membershipError } = await supabase
        .from('group_members')
        .select('group_id, role, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (membershipError) throw membershipError;

      const memberships = membershipRows || [];
      if (memberships.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = memberships.map((membership) => membership.group_id);
      const roleByGroupId = Object.fromEntries(memberships.map((membership) => [membership.group_id, membership.role])) as Record<number, 'owner' | 'member'>;

      const { data: groupRows, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, invite_code, festival_id, created_at, is_blocked, festivals(id, name, year, location, start_date, end_date, emoji, color)')
        .in('id', groupIds)
        .eq('is_blocked', false)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      const { data: memberCountRows, error: memberCountError } = await supabase.from('group_members').select('group_id').in('group_id', groupIds);
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
        festival_location: group.festivals?.location || null,
        festival_start_date: group.festivals?.start_date || null,
        festival_end_date: group.festivals?.end_date || null,
        member_count: countByGroupId[group.id] || 0
      }));

      setGroups(mappedGroups);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load your groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const loadInitialData = async () => {
      setLoading(true);
      setError(null);

      await loadGroups();

      const { data: festivalRows, error: festivalError } = await supabase
        .from('festivals')
        .select('id, name, year, location, start_date, end_date, emoji, color')
        .order('start_date', { ascending: true });

      if (festivalError) {
        setFestivals([]);
        setSelectedFestivalId('');
        setError(`Could not load available festivals for group creation: ${festivalError.message}`);
        setLoading(false);
        return;
      }

      const mappedFestivals = festivalRows || [];
      setFestivals(mappedFestivals);
      setSelectedFestivalId((current) => current || (mappedFestivals[0]?.id ? String(mappedFestivals[0].id) : ''));
      setLoading(false);
    };

    loadInitialData();
  }, [authReady, router, supabase, user]);

  const selectedFestival = useMemo(() => festivals.find((festival) => String(festival.id) === selectedFestivalId), [festivals, selectedFestivalId]);

  const resetCreateForm = () => {
    setGroupName('');
    setShowCreateModal(false);
  };

  const copyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(null), 1600);
  };

  const shareGroup = async (group: UserGroup) => {
    const shareText = `Join my Lineup-Mate group "${group.name}" for ${group.festival_name}! Invite code: ${group.invite_code}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: group.name, text: shareText });
        return;
      } catch {
        // fall through to WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCreateGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const trimmedName = groupName.trim();
    const festivalId = Number(selectedFestivalId);

    if (!trimmedName) {
      setError('Enter a group name.');
      return;
    }

    if (!festivalId) {
      setError('Choose a festival for the group.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setMessage(null);

    try {
      await saveFestivalForUser(festivalId);

      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({ festival_id: festivalId, name: trimmedName, owner_user_id: user.id })
        .select('id')
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase.from('group_members').insert({ group_id: newGroup.id, user_id: user.id, role: 'owner' });
      if (memberError) throw memberError;

      setGroupName('');
      setShowCreateModal(false);
      await loadGroups();
      router.push(`/group/${newGroup.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create group.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const code = inviteCode.trim().toLowerCase();

    if (!code) {
      setError('Enter an invite code.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data: joinedGroupId, error: rpcError } = await supabase.rpc('join_group_by_invite_code', { p_invite_code: code });
      if (rpcError) throw rpcError;

      const { data: joinedGroup, error: joinedGroupError } = await supabase
        .from('groups')
        .select('festival_id')
        .eq('id', joinedGroupId)
        .single();

      if (joinedGroupError) throw joinedGroupError;
      await saveFestivalForUser(joinedGroup.festival_id);

      setInviteCode('');
      await loadGroups();
      router.push(`/group/${joinedGroupId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not join group.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderCreateGroupForm = (compact = false) => (
    <form onSubmit={handleCreateGroup} data-testid="create-group-panel" className={compact ? 'space-y-4' : 'rounded-[28px] p-5'} style={compact ? undefined : { background: c.surf, border: `1px solid ${c.brd}` }}>
      <h2 className="mb-2 text-xl font-black">Create a group</h2>
      <p className="mb-4 text-sm" style={{ color: c.muted }}>Choose any available festival and create a shared schedule for that specific event. Creating a group also saves that festival to your schedule.</p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase tracking-widest" style={{ color: c.muted }}>Group name</span>
          <input data-testid="group-name-input" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Ozora Squad 2026" className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }} maxLength={60} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase tracking-widest" style={{ color: c.muted }}>Festival</span>
          <select data-testid="group-festival-select" value={selectedFestivalId} onChange={(event) => setSelectedFestivalId(event.target.value)} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>
            {festivals.length === 0 && <option value="">No festivals available</option>}
            {festivals.map((festival) => <option key={festival.id} value={festival.id}>{festival.name} {festival.year}</option>)}
          </select>
        </label>

        {selectedFestival && (
          <div className="rounded-2xl p-3 text-sm" style={{ background: c.surf2, color: c.muted, border: `1px solid ${c.brd}` }}>
            <b style={{ color: c.txt }}>{selectedFestival.emoji || '🎪'} {selectedFestival.name}</b>
            <div>{selectedFestival.location || 'Location TBA'}</div>
            <div>{formatDateRange(selectedFestival.start_date, selectedFestival.end_date)}</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {compact && <button type="button" onClick={resetCreateForm} className="flex-1 rounded-full px-5 py-3 text-sm font-black" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}>Cancel</button>}
        <button type="submit" data-testid="create-group-submit" disabled={actionLoading || !selectedFestivalId || !groupName.trim()} className="flex-1 rounded-full px-5 py-3 text-sm font-black text-white disabled:opacity-50" style={{ background: selectedFestival?.color || c.acc }}>
          {actionLoading ? 'Working…' : 'Create Group'}
        </button>
      </div>
    </form>
  );

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-6xl px-4 py-8">
          <header className="mb-6 rounded-[28px] p-6 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c.acc }}>Lineup·Mate</p>
                <h1 className="text-4xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>My Groups</h1>
                <p className="mt-2 text-sm" style={{ color: c.muted }}>Create groups per festival, invite friends, and open a shared schedule that shows everyone's picks.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {groups.length > 0 && <button type="button" data-testid="open-create-group-modal" onClick={() => setShowCreateModal(true)} className="rounded-full px-4 py-2 text-sm font-black text-white" style={{ background: c.acc }}>Create Group</button>}
                <button type="button" onClick={() => router.push('/')} className="rounded-full px-4 py-2 text-sm font-black" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>Browse Festivals</button>
              </div>
            </div>
          </header>

          {error && <p data-testid="groups-error" className="mb-4 rounded-xl p-4 text-sm text-red-700" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>{error}</p>}
          {message && <p className="mb-4 rounded-xl p-4 text-sm text-green-700" style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}>{message}</p>}

          <section className={`mb-6 grid grid-cols-1 gap-4 ${groups.length === 0 ? 'lg:grid-cols-2' : ''}`}>
            {groups.length === 0 && renderCreateGroupForm()}
            <form onSubmit={handleJoinGroup} data-testid="join-group-panel" className="rounded-[28px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
              <h2 className="mb-2 text-xl font-black">Join a group</h2>
              <p className="mb-4 text-sm" style={{ color: c.muted }}>Paste an invite code from a friend to join their festival schedule. Joining also saves the group's festival to your schedule.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input data-testid="join-group-code-input" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Invite code" className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }} />
                <button type="submit" data-testid="join-group-submit" disabled={actionLoading || !inviteCode.trim()} className="rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-50" style={{ background: c.acc }}>{actionLoading ? 'Joining…' : 'Join'}</button>
              </div>
            </form>
          </section>

          {loading && <p style={{ color: c.muted }}>Loading groups…</p>}

          {!loading && groups.length === 0 && !error && <div data-testid="no-groups-state" className="rounded-[28px] p-8 text-center" style={{ background: c.surf, border: `1px solid ${c.brd}` }}><div className="text-5xl">👥</div><h2 className="mt-3 text-2xl font-black">No groups yet</h2><p className="mt-2 text-sm" style={{ color: c.muted }}>Create your first group above, or join one with an invite code.</p></div>}

          {groups.length > 0 && <h2 className="mb-4 text-2xl font-black">Your groups</h2>}
          <div data-testid="groups-list" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <article key={group.id} data-testid="group-card" className="fade-up overflow-hidden rounded-[28px] shadow-xl transition-all hover:shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <div className="h-px" style={{ background: c.brd }} />
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm" style={{ background: `${group.festival_color}18`, border: `1px solid ${group.festival_color}33` }}>{group.festival_emoji}</div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em]" style={{ color: group.festival_color }}>{group.festival_name} {group.festival_year}</p>
                        <h3 className="text-xl font-black leading-snug" style={{ letterSpacing: '-0.01em' }}>{group.name}</h3>
                        <p className="mt-0.5 text-xs" style={{ color: c.muted }}>{group.festival_location || 'Location TBA'}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black capitalize" style={{ background: c.surf2, color: c.muted, border: `1px solid ${c.brd}` }}>{group.member_role}</span>
                  </div>

                  <div className="mb-3 flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: c.surf2, border: `1px solid ${c.brd}` }}>
                    <code data-testid="group-invite-code" className="min-w-0 flex-1 text-sm font-black" style={{ color: c.txt, letterSpacing: '0.06em' }}>{group.invite_code}</code>
                    <button type="button" data-testid="copy-invite-code" onClick={() => copyInviteCode(group.invite_code)} className="shrink-0 rounded-full px-3 py-1 text-xs font-black text-white transition" style={{ background: copiedCode === group.invite_code ? c.success : c.acc }}>
                      {copiedCode === group.invite_code ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="mb-3 flex items-center gap-3 text-sm" style={{ color: c.muted }}>
                    <span className="font-bold" style={{ color: c.txt }}>{group.member_count}</span> members
                    <span className="mx-1 opacity-40">·</span>
                    <span>{new Date(group.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" data-testid="open-group-schedule" onClick={() => router.push(`/group/${group.id}`)} className="rounded-full px-4 py-2 text-sm font-black text-white" style={{ background: group.festival_color }}>Open Schedule</button>
                    <button type="button" onClick={() => router.push(`/festival/${group.festival_id}`)} className="rounded-full px-4 py-2 text-sm font-black" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>Festival</button>
                    <button type="button" onClick={() => shareGroup(group)} className="rounded-full px-4 py-2 text-sm font-black" style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}>Share</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {showCreateModal && (
          <div data-testid="create-group-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(5px)' }} onClick={resetCreateForm}>
            <div className="w-full max-w-lg rounded-[28px] p-6 shadow-2xl" style={{ background: c.surf, border: `1px solid ${c.brd}` }} onClick={(event) => event.stopPropagation()}>
              {renderCreateGroupForm(true)}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
