-- Language preference has been removed from Lineup-Mate.
-- The app is fixed to English/LTR and keeps only theme/avatar/profile settings.

alter table if exists public.profiles
  drop column if exists language;
