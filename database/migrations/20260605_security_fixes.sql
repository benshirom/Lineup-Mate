-- Security fixes migration: 2026-06-05
-- DB-001: Restrict profiles SELECT RLS (was: all authenticated users)
-- DB-002: Restrict group_members SELECT RLS (was: all authenticated users)
-- PERF-001/002/003: Add missing composite indexes

-- ─── DB-001: profiles SELECT policy ───────────────────────────────────────────
-- Drop the overly-permissive policy and replace with one that allows reading
-- your own profile or any profile of someone who shares a group with you.
-- Uses the existing shares_group_with() SECURITY DEFINER helper to avoid
-- infinite RLS recursion.

DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;

CREATE POLICY "Users can read own or shared-group profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.shares_group_with(id)
  );

-- ─── DB-002: group_members SELECT policy ─────────────────────────────────────
-- Drop the open MVP policy and replace with one that only allows members of a
-- group to see its membership list.
-- Uses the existing my_group_ids() SECURITY DEFINER helper.

DROP POLICY IF EXISTS "Authenticated users can read group memberships" ON public.group_members;

CREATE POLICY "Group members can read their own group memberships"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (SELECT public.my_group_ids())
  );

-- ─── PERF-001: group_members(user_id) index ──────────────────────────────────
-- Speeds up "find all groups for user X" queries.
CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON public.group_members(user_id);

-- ─── PERF-002: performances(festival_id, stage_id) composite index ───────────
CREATE INDEX IF NOT EXISTS idx_performances_festival_stage
  ON public.performances(festival_id, stage_id);

-- ─── PERF-003: user_performance_preferences(user_id, performance_id) ─────────
-- The unique constraint implicitly creates an index, but an explicit named one
-- makes query planning clearer.
CREATE INDEX IF NOT EXISTS idx_user_perf_prefs_user_perf
  ON public.user_performance_preferences(user_id, performance_id);

-- ─── Additional composite index for group page queries ───────────────────────
-- Speeds up "find all members for group X" queries used on the group schedule page.
CREATE INDEX IF NOT EXISTS idx_group_members_group_id
  ON public.group_members(group_id);
