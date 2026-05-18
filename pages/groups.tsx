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
  const inputStyle = { background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt };

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
        .select('id, name, invite_code, festival_id, created_at, festivals(id, name, year, location, start_date, end_date, emoji, color)')
        .in('id', groupIds)
        .order('created_at', { ascending: false });
      if (groupsError) throw groupsError;

      const { data: memberCountRows, error: memberCountError } = await supabase.from('group_members').select('group_id').in('group_id', groupIds);
      if (memberCountError) throw memberCountError;

      const countByGroupId = (memberCountRows || []).reduce<Record<number, number>>((acc, row) => {
        acc[row.group_id] = (acc[row.group_id] || 0) + 1;
        return acc;
      }, {});

      setGroups((groupRows || []).map((group: any) => ({
        id: group.id,
        name: group.name,
        invite_code: group.invite_code,
        festival_id: group.festival_id,
        created_at: group.created_at,
        member_role: roleByGroupId[group.id] || 'member',
        festival_name: group.festivals?.name || 'Festival',
        festival_year: group.festivals?.year || new Date(group.created_at).getFullYear(),
        festival_emoji: group.festivals?.emoji || 'LM',
        festival_color: group.festivals?.color || c.secondary,
        festival_location: group.festivals?.location || null,
        festival_start_date: group.festivals?.start_date || null,
        festival_end_date: group.festivals?.end_date || null,
        member_count: countByGroupId[group.id] || 0
      })));
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
    if (!trimmedName) { setError('Enter a group name.'); return; }
    if (!festivalId) { setError('Choose a festival for the group.'); return; }

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
    if (!code) { setError('Enter an invite code.'); return; }

    setActionLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data: joinedGroupId, error: rpcError } = await supabase.rpc('join_group_by_invite_code', { p_invite_code: code });
      if (rpcError) throw rpcError;
      const { data: joinedGroup, error: joinedGroupError } = await supabase.from('groups').select('festival_id').eq('id', joinedGroupId).single();
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
    <form onSubmit={handleCreateGroup} data-testid="create-group-panel" className={compact ? 'space-y-4' : 'premium-card p-5'}>
      <div className="relative z-10">
        <h2 className="app-title mb-2 text-2xl font-black">Create a group</h2>
        <p className="mb-5 text-sm leading-6" style={{ color: c.muted }}>Choose a festival and create a shared schedule for friends. Creating a group also saves that festival to your schedule.</p>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Group name</span>
            <input data-testid="group-name-input" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Ozora Squad 2026" className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} maxLength={60} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.muted }}>Festival</span>
            <select data-testid="group-festival-select" value={selectedFestivalId} onChange={(event) => setSelectedFestivalId(event.target.value)} className="mobile-action w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle}>
              {festivals.length === 0 && <option value="">No festivals available</option>}
              {festivals.map((festival) => <option key={festival.id} value={festival.id}>{festival.name} {festival.year}</option>)}
            </select>
          </label>
          {selectedFestival && (
            <div className="rounded-2xl p-4 text-sm" style={{ background: c.surfaceHover, color: c.muted, border: `1px solid ${c.border}` }}>
              <b style={{ color: c.txt }}>{selectedFestival.name}</b>
              <div>{selectedFestival.location || 'Location TBA'}</div>
              <div>{formatDateRange(selectedFestival.start_date, selectedFestival.end_date)}</div>
            </div>
          )}
        </div>
        <div className="mt-5 flex gap-2">
          {compact && <button type="button" onClick={resetCreateForm} className="mobile-action flex-1 rounded-2xl px-5 py-3 text-sm font-black" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.muted }}>Cancel</button>}
          <button type="submit" data-testid="create-group-submit" disabled={actionLoading || !selectedFestivalId || !groupName.trim()} className="mobile-action flex-1 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, boxShadow: c.glow }}>
            {actionLoading ? 'Working…' : 'Create Group'}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <>
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <header className="premium-card mb-6 p-5 sm:p-6">
            <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: c.primary }}>Lineup·Mate</p>
                <h1 className="app-title mt-2 text-4xl font-black leading-tight sm:text-5xl">My Groups</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: c.textSecondary }}>Create groups per festival, invite friends and compare everyone’s picks in one shared schedule.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {groups.length > 0 && <button type="button" data-testid="open-create-group-modal" onClick={() => setShowCreateModal(true)} className="mobile-action rounded-2xl px-5 py-3 text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>Create Group</button>}
                <button type="button" onClick={() => router.push('/')} className="mobile-action rounded-2xl px-5 py-3 text-sm font-black" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt }}>Browse Festivals</button>
              </div>
            </div>
          </header>

          {error && <p data-testid="groups-error" className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.26)', color: c.danger }}>{error}</p>}
          {message && <p className="mb-4 rounded-2xl p-4 text-sm font-bold" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.26)', color: c.success }}>{message}</p>}

          <section className={`mb-6 grid grid-cols-1 gap-4 ${groups.length === 0 ? 'lg:grid-cols-2' : ''}`}>
            {groups.length === 0 && renderCreateGroupForm()}
            <form onSubmit={handleJoinGroup} data-testid="join-group-panel" className="premium-card p-5">
              <div className="relative z-10">
                <h2 className="app-title mb-2 text-2xl font-black">Join a group</h2>
                <p className="mb-5 text-sm leading-6" style={{ color: c.muted }}>Paste an invite code from a friend. Joining also saves the group’s festival to your schedule.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input data-testid="join-group-code-input" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Invite code" className="mobile-action min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} />
                  <button type="submit" data-testid="join-group-submit" disabled={actionLoading || !inviteCode.trim()} className="mobile-action rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-50" style={{ background: c.secondary }}>{actionLoading ? 'Joining…' : 'Join'}</button>
                </div>
              </div>
            </form>
          </section>

          {loading && <p style={{ color: c.muted }}>Loading groups…</p>}

          {!loading && groups.length === 0 && !error && (
            <div data-testid="no-groups-state" className="premium-card p-8 text-center">
              <div className="relative z-10"><h2 className="app-title text-2xl font-black">No groups yet</h2><p className="mt-2 text-sm" style={{ color: c.muted }}>Create your first group above, or join one with an invite code.</p></div>
            </div>
          )}

          {groups.length > 0 && <h2 className="app-title mb-4 text-2xl font-black">Your groups</h2>}
          <div data-testid="groups-list" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <article key={group.id} data-testid="group-card" className="premium-card fade-up p-5 transition hover:-translate-y-0.5">
                <div className="relative z-10">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: c.secondary }}>{group.festival_name} {group.festival_year}</p>
                      <h3 className="app-title truncate text-2xl font-black leading-tight">{group.name}</h3>
                      <p className="mt-1 truncate text-sm" style={{ color: c.muted }}>{group.festival_location || 'Location TBA'} · {formatDateRange(group.festival_start_date, group.festival_end_date)}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black capitalize" style={{ background: c.primarySoft, color: c.primary, border: '1px solid rgba(139,92,246,0.26)' }}>{group.member_role}</span>
                  </div>

                  <div className="mb-3 flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: c.surfaceHover, border: `1px solid ${c.border}` }}>
                    <code data-testid="group-invite-code" className="min-w-0 flex-1 text-sm font-black tracking-[0.06em]" style={{ color: c.txt }}>{group.invite_code}</code>
                    <button type="button" data-testid="copy-invite-code" onClick={() => copyInviteCode(group.invite_code)} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-black text-white transition" style={{ background: copiedCode === group.invite_code ? c.success : c.secondary }}>
                      {copiedCode === group.invite_code ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="mb-4 text-sm" style={{ color: c.muted }}><b style={{ color: c.txt }}>{group.member_count}</b> members · {new Date(group.created_at).toLocaleDateString()}</div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button type="button" data-testid="open-group-schedule" onClick={() => router.push(`/group/${group.id}`)} className="mobile-action rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>Open</button>
                    <button type="button" onClick={() => router.push(`/festival/${group.festival_id}`)} className="mobile-action rounded-2xl px-4 py-3 text-sm font-black" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt }}>Festival</button>
                    <button type="button" onClick={() => shareGroup(group)} className="mobile-action rounded-2xl px-4 py-3 text-sm font-black" style={{ background: c.surfaceHover, border: `1px solid ${c.border}`, color: c.txt }}>Share</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {showCreateModal && (
          <div data-testid="create-group-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(5px)' }} onClick={resetCreateForm}>
            <div className="w-full max-w-lg rounded-[28px] p-6 shadow-2xl" style={{ background: c.surface, border: `1px solid ${c.border}` }} onClick={(event) => event.stopPropagation()}>{renderCreateGroupForm(true)}</div>
          </div>
        )}
      </main>
    </>
  );
}
