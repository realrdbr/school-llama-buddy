-- Secure permissions table: remove public read access while preserving admin/self access
BEGIN;

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive public read policy
DROP POLICY IF EXISTS "Enable read access for all users" ON public.permissions;

-- Optional: ensure specific safe policies remain (no changes here, just documentation)
-- Existing safe policies expected to remain:
--   "Users can view own profile data" (SELECT USING (id = get_current_user_id()))
--   "School admins can view all permissions" (SELECT USING (is_current_user_admin()))
--   or "Admins can view all user data" (SELECT USING (is_current_user_admin_safe()))

COMMIT;