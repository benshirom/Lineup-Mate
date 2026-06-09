-- Add source tracking columns to performances table.
-- These are used by importNormalizedFestival to track sync state and deduplicate.

ALTER TABLE public.performances
  ADD COLUMN IF NOT EXISTS source_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_external_id text;

CREATE INDEX IF NOT EXISTS idx_performances_source_external_id
  ON public.performances(source_external_id)
  WHERE source_external_id IS NOT NULL;
