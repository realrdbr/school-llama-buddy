-- Phase 1: Critical Security Fixes

-- 1. Create password hashing functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to hash passwords using bcrypt
CREATE OR REPLACE FUNCTION public.hash_password(password_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(password_text, gen_salt('bf', 12));
END;
$$;

-- Function to verify passwords
CREATE OR REPLACE FUNCTION public.verify_password(password_text text, hashed_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(password_text, hashed_password) = hashed_password;
END;
$$;

-- 2. Add new hashed_password column and migrate existing passwords
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS hashed_password text;

-- Hash all existing plaintext passwords
UPDATE public.permissions 
SET hashed_password = public.hash_password(password)
WHERE hashed_password IS NULL;

-- 3. Update password-related functions to use hashing
CREATE OR REPLACE FUNCTION public.verify_user_login(username_input text, password_input text)
RETURNS TABLE(user_id bigint, profile_id bigint, permission_level smallint, must_change_password boolean, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::bigint as user_id,
    p.id::bigint as profile_id,
    p.permission_lvl,
    p.must_change_password,
    p.name as full_name
  FROM permissions p
  WHERE p.username = username_input 
    AND public.verify_password(password_input, p.hashed_password);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_user_password(user_id_input bigint, old_password text, new_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hashed_password text;
BEGIN
  -- Verify old password
  SELECT hashed_password INTO current_hashed_password
  FROM permissions
  WHERE id = user_id_input;
  
  IF NOT public.verify_password(old_password, current_hashed_password) THEN
    RETURN json_build_object('error', 'Altes Passwort ist falsch');
  END IF;
  
  -- Update with new hashed password
  UPDATE permissions
  SET 
    hashed_password = public.hash_password(new_password),
    must_change_password = false
  WHERE id = user_id_input;
  
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_school_user(username_input text, password_input text, full_name_input text, permission_level_input smallint, creator_user_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id BIGINT;
  creator_permission SMALLINT;
BEGIN
  -- Check if creator has permission level 10 (Schulleitung)
  SELECT permission_lvl INTO creator_permission
  FROM permissions
  WHERE id = creator_user_id;
  
  IF creator_permission IS NULL OR creator_permission < 10 THEN
    RETURN json_build_object('error', 'Keine Berechtigung zum Erstellen von Benutzern');
  END IF;
  
  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM permissions WHERE username = username_input) THEN
    RETURN json_build_object('error', 'Benutzername bereits vergeben');
  END IF;
  
  -- Create user with hashed password
  INSERT INTO permissions (
    username,
    password, -- Keep for backward compatibility temporarily
    hashed_password,
    name,
    permission_lvl,
    must_change_password
  ) VALUES (
    username_input,
    password_input, -- Temporary
    public.hash_password(password_input),
    full_name_input,
    permission_level_input,
    true
  ) RETURNING id INTO new_user_id;
  
  RETURN json_build_object('success', true, 'user_id', new_user_id);
END;
$$;

-- 4. Fix RLS policies - Remove dangerous public access policies

-- Drop conflicting public policies on audio_announcements
DROP POLICY IF EXISTS "Public can delete audio announcements" ON public.audio_announcements;
DROP POLICY IF EXISTS "Public can insert audio announcements" ON public.audio_announcements;
DROP POLICY IF EXISTS "Public can update audio announcements" ON public.audio_announcements;
DROP POLICY IF EXISTS "Public can view audio announcements" ON public.audio_announcements;

-- Keep only the level-10+ policies for audio_announcements
-- (These are already in place, so no changes needed)

-- Secure user_sessions table
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.user_sessions;

CREATE POLICY "Users can view their own sessions" ON public.user_sessions
FOR SELECT USING (
  user_id IN (
    SELECT id FROM permissions p
    WHERE p.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)
  )
);

CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
FOR INSERT WITH CHECK (
  user_id IN (
    SELECT id FROM permissions p
    WHERE p.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)
  )
);

CREATE POLICY "Users can update their own sessions" ON public.user_sessions
FOR UPDATE USING (
  user_id IN (
    SELECT id FROM permissions p
    WHERE p.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)
  )
);

-- Secure user_permissions table
DROP POLICY IF EXISTS "Public read user perms" ON public.user_permissions;

CREATE POLICY "Users can view relevant user permissions" ON public.user_permissions
FOR SELECT USING (
  -- Users can see their own permissions
  user_id IN (
    SELECT id FROM permissions p
    WHERE p.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)
  )
  OR
  -- Admins can see all permissions
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)
    AND p.permission_lvl >= 10
  )
);

-- Secure level_permissions table
DROP POLICY IF EXISTS "Public read level perms" ON public.level_permissions;

CREATE POLICY "Authenticated users can view level permissions" ON public.level_permissions
FOR SELECT USING (
  -- Only authenticated users can view level permissions
  ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text) IS NOT NULL
);

-- Secure user_themes table - restrict to user's own themes
DROP POLICY IF EXISTS "Allow theme operations" ON public.user_themes;

CREATE POLICY "Users can manage their own themes" ON public.user_themes
FOR ALL USING (
  user_id IN (
    SELECT id FROM permissions p
    WHERE p.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)
  )
)
WITH CHECK (
  user_id IN (
    SELECT id FROM permissions p
    WHERE p.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)
  )
);

-- 5. Remove overly permissive "Enable read access for all users" policy from permissions table
DROP POLICY IF EXISTS "Enable read access for all users" ON public.permissions;