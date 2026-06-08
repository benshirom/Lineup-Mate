-- Rotate all existing invite codes that were generated with the old 6-byte (48-bit) entropy.
-- New groups already get 12-byte codes via the DEFAULT set in 20260608_security_hardening.sql.
-- This migration updates existing short codes so all codes are at least 24 hex chars (96-bit).

UPDATE public.groups
SET invite_code = encode(gen_random_bytes(12), 'hex')
WHERE char_length(invite_code) < 24;
