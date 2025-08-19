-- Create permission definitions and assignment tables for granular permissions
-- 1) permission_definitions
CREATE TABLE IF NOT EXISTS public.permission_definitions (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  requires_level smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) level_permissions
CREATE TABLE IF NOT EXISTS public.level_permissions (
  level smallint NOT NULL,
  permission_id text NOT NULL REFERENCES public.permission_definitions(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (level, permission_id)
);

-- 3) user_permissions (overrides per user)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id bigint NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES public.permission_definitions(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

-- Enable RLS
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no auth in app yet). Adjust later when auth is set up.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='permission_definitions' AND policyname='Public can read permissions') THEN
    CREATE POLICY "Public can read permissions" ON public.permission_definitions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='permission_definitions' AND policyname='Admins manage permission defs') THEN
    CREATE POLICY "Admins manage permission defs" ON public.permission_definitions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='level_permissions' AND policyname='Public read level perms') THEN
    CREATE POLICY "Public read level perms" ON public.level_permissions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='level_permissions' AND policyname='Admins manage level perms') THEN
    CREATE POLICY "Admins manage level perms" ON public.level_permissions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_permissions' AND policyname='Public read user perms') THEN
    CREATE POLICY "Public read user perms" ON public.user_permissions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_permissions' AND policyname='Admins manage user perms') THEN
    CREATE POLICY "Admins manage user perms" ON public.user_permissions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed permission definitions
INSERT INTO public.permission_definitions (id, name, description, requires_level)
VALUES
  ('view_chat', 'KI-Chat verwenden', 'Zugriff auf den KI-Assistenten', 1),
  ('view_schedule', 'Stundenplan einsehen', 'Eigenen Stundenplan anzeigen', 1),
  ('view_announcements', 'Ankündigungen lesen', 'Schulankündigungen einsehen', 1),
  ('view_vertretungsplan', 'Vertretungsplan einsehen', 'Vertretungen anzeigen', 1),
  ('create_announcements', 'Ankündigungen erstellen', 'Neue Ankündigungen verfassen', 4),
  ('edit_announcements', 'Ankündigungen bearbeiten', 'Bestehende Ankündigungen ändern', 4),
  ('manage_substitutions', 'Vertretungen verwalten', 'Vertretungsplan bearbeiten', 9),
  ('manage_schedules', 'Stundenpläne verwalten', 'Stundenpläne erstellen/bearbeiten', 9),
  ('document_analysis', 'Dokumenten-Analyse', 'KI-Dokumentenanalyse verwenden', 4),
  ('audio_announcements', 'Audio-Durchsagen', 'TTS-Durchsagen erstellen/verwalten', 10),
  ('user_management', 'Benutzerverwaltung', 'Benutzer erstellen/bearbeiten/löschen', 10),
  ('permission_management', 'Berechtigungen verwalten', 'Benutzerberechtigungen ändern', 10),
  ('keycard_system', 'Keycard-System', 'Zugangskontrolle konfigurieren', 10),
  ('system_settings', 'Systemeinstellungen', 'Arduino-Geräte und System verwalten', 10)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, requires_level = EXCLUDED.requires_level;

-- Seed default level permissions: allowed when level >= requires_level
INSERT INTO public.level_permissions (level, permission_id, allowed)
SELECT lvl, pd.id, (lvl >= pd.requires_level)
FROM generate_series(1,10) AS lvl
CROSS JOIN public.permission_definitions pd
ON CONFLICT (level, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_level_permissions_perm ON public.level_permissions (permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_perm ON public.user_permissions (permission_id);
