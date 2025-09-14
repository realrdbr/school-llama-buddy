-- Phase 1: Critical Security Fixes (Using built-in functions)

-- 1. Create password hashing functions using built-in SHA256
CREATE OR REPLACE FUNCTION public.hash_password(password_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  salt text;
BEGIN
  -- Generate a random salt
  salt := encode(gen_random_bytes(16), 'hex');
  -- Return salt + hash
  RETURN salt || ':' || encode(digest(salt || password_text, 'sha256'), 'hex');
END;
$$;

-- Function to verify passwords
CREATE OR REPLACE FUNCTION public.verify_password(password_text text, hashed_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  salt text;
  stored_hash text;
  computed_hash text;
BEGIN
  -- Extract salt and hash
  salt := split_part(hashed_password, ':', 1);
  stored_hash := split_part(hashed_password, ':', 2);
  
  -- Compute hash with extracted salt
  computed_hash := encode(digest(salt || password_text, 'sha256'), 'hex');
  
  RETURN computed_hash = stored_hash;
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