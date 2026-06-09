-- View for admin use: exposes only id and email_confirmed_at from auth.users.
-- Replaces the need to call auth.admin.listUsers({ perPage: 1000 }) just to get confirmation status.
CREATE OR REPLACE VIEW public.auth_users_email_confirmed
WITH (security_invoker = false) AS
  SELECT id, email_confirmed_at
  FROM auth.users;

-- Only service_role (used by supabaseAdmin) can read this view.
REVOKE ALL ON public.auth_users_email_confirmed FROM anon, authenticated;
GRANT SELECT ON public.auth_users_email_confirmed TO service_role;
