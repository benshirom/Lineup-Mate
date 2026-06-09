import { useState } from 'react';
import { useRouter } from 'next/router';
import { formatDateRange } from '@/lib/platform';
import { useAuth } from '@/lib/AuthContext';
import type { Festival, PerformanceItem } from '@/lib/festivalTypes';
import type { getThemeColors } from '@/lib/platform';

interface FestivalInfoTabProps {
  festival: Festival;
  onFestivalUpdate: (updated: Festival) => void;
  allStages: { name: string; color: string }[];
  days: string[];
  performances: PerformanceItem[];
  onCreateGroup: () => void;
  c: ReturnType<typeof getThemeColors>;
}

export function FestivalInfoTab({ festival, onFestivalUpdate, allStages, days, performances, onCreateGroup, c }: FestivalInfoTabProps) {
  const router = useRouter();
  const { user, supabase, profile } = useAuth();

  const [editingInfo, setEditingInfo] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [fetchingDescription, setFetchingDescription] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoinGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    setJoinError(null);
    if (!user) { router.push('/login'); return; }
    if (!inviteCode.trim()) { setJoinError('Enter an invite code.'); return; }
    try {
      const { data: joinedGroupId, error: rpcError } = await supabase.rpc('join_group_by_invite_code', {
        p_invite_code: inviteCode.trim().toLowerCase()
      });
      if (rpcError) throw rpcError;
      router.push(`/group/${joinedGroupId}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Could not join group.');
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_300px]">
        <article className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-extrabold">About</h2>
            {profile?.role === 'admin' && !editingInfo && (
              <button
                type="button"
                onClick={() => {
                  setEditDescription(festival.description || '');
                  setEditLocation(festival.location || '');
                  setEditWebsite(festival.website || '');
                  setFetchError(null);
                  setEditingInfo(true);
                }}
                className="tap-active rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
              >
                Edit
              </button>
            )}
          </div>
          {editingInfo ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold" style={{ color: c.muted }}>Description</label>
                  <button
                    type="button"
                    disabled={fetchingDescription}
                    onClick={async () => {
                      setFetchingDescription(true);
                      setFetchError(null);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const res = await fetch('/api/admin/fetch-festival-info', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                          body: JSON.stringify({ festivalId: festival.id, festivalName: festival.name }),
                        });
                        const json = await res.json() as { description?: string | null; error?: string };
                        if (json.description) {
                          setEditDescription(json.description);
                        } else {
                          setFetchError(json.error ?? 'No description found.');
                        }
                      } catch {
                        setFetchError('Request failed.');
                      } finally {
                        setFetchingDescription(false);
                      }
                    }}
                    className="tap-active rounded-full px-2.5 py-1 text-[11px] font-bold disabled:opacity-50"
                    style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
                  >
                    {fetchingDescription ? 'Fetching…' : '🔍 Fetch from Google'}
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Festival description…"
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                  style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt }}
                />
                {fetchError && (
                  <p className="mt-1 text-xs font-semibold" style={{ color: c.danger }}>{fetchError}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: c.muted }}>Location</label>
                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="City, Country"
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 44 }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: c.muted }}>Website</label>
                <input
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://…"
                  type="url"
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 44 }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingInfo(false)}
                  className="flex-1 tap-active rounded-2xl px-4 py-2.5 text-sm font-bold"
                  style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.muted }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingInfo}
                  onClick={async () => {
                    setSavingInfo(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch(`/api/admin/festivals/${festival.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                        body: JSON.stringify({ description: editDescription || null, location: editLocation || null, website: editWebsite || null }),
                      });
                      if (res.ok) {
                        onFestivalUpdate({ ...festival, description: editDescription || null, location: editLocation || null, website: editWebsite || null });
                        setEditingInfo(false);
                      }
                    } finally {
                      setSavingInfo(false);
                    }
                  }}
                  className="flex-1 tap-active rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: festival.color || c.acc }}
                >
                  {savingInfo ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            festival.description
              ? <p className="leading-7 text-sm" style={{ color: c.muted }}>{festival.description}</p>
              : <p className="text-sm italic" style={{ color: `${c.muted}88` }}>No description yet.</p>
          )}
        </article>
        <aside className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
          <h2 className="mb-3 text-xl font-extrabold">Festival details</h2>
          <div className="space-y-2.5 text-sm" style={{ color: c.muted }}>
            <div><b style={{ color: c.txt }}>Location:</b> {festival.location || 'TBA'}</div>
            <div><b style={{ color: c.txt }}>Dates:</b> {formatDateRange(festival.start_date, festival.end_date)}</div>
            <div><b style={{ color: c.txt }}>Stages:</b> {allStages.length}</div>
            <div><b style={{ color: c.txt }}>Days:</b> {days.length}</div>
            <div><b style={{ color: c.txt }}>Performances:</b> {performances.length}</div>
            {festival.website && (
              <div>
                <b style={{ color: c.txt }}>Website:</b>{' '}
                <a href={festival.website} target="_blank" rel="noopener noreferrer" style={{ color: c.acc }}>{festival.website}</a>
              </div>
            )}
            {festival.clashfinder_slug && <div><b style={{ color: c.txt }}>Source:</b> {festival.clashfinder_slug}</div>}
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
          <h2 className="mb-2 font-extrabold">Create a group</h2>
          <p className="mb-4 text-sm" style={{ color: c.muted }}>Open a shared schedule and invite friends to compare picks.</p>
          <button
            type="button"
            onClick={onCreateGroup}
            className="tap-active rounded-2xl px-4 py-3 text-sm font-bold text-white"
            style={{ background: festival.color || c.acc, minHeight: 48 }}
          >
            {user ? 'Create Group' : 'Sign in to Create Group'}
          </button>
        </div>
        <form onSubmit={handleJoinGroup} className="rounded-3xl p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
          <h2 className="mb-2 font-extrabold">Join a group</h2>
          <p className="mb-4 text-sm" style={{ color: c.muted }}>Paste an invite code from a friend.</p>
          <div className="flex gap-2">
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Invite code"
              className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: c.surf2, border: `1px solid ${c.brd}`, color: c.txt, minHeight: 48 }}
            />
            <button
              type="submit"
              className="tap-active rounded-2xl px-4 py-3 text-sm font-bold text-white"
              style={{ background: c.acc, minHeight: 48 }}
            >
              {user ? 'Join' : 'Sign in'}
            </button>
          </div>
          {joinError && <p className="mt-2 text-sm font-semibold" style={{ color: c.danger }}>{joinError}</p>}
        </form>
      </section>
    </div>
  );
}
