-- Security hardening migration (2026-06-08)
-- Addresses findings: 8-C (invite code entropy), 10-B (display_name length constraint)

-- Increase invite_code entropy from 48 bits (6 bytes) to 96 bits (12 bytes).
-- Existing codes are not changed; only new groups receive the longer code.
ALTER TABLE groups ALTER COLUMN invite_code SET DEFAULT encode(gen_random_bytes(12), 'hex');

-- Enforce a maximum length on display_name to prevent excessively long values
-- from causing UI layout issues or unexpected downstream behaviour.
ALTER TABLE profiles
  ADD CONSTRAINT profiles_display_name_length
  CHECK (display_name IS NULL OR char_length(display_name) <= 100);
