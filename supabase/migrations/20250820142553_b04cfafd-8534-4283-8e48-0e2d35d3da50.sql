-- Create class_permissions table for per-class overrides
CREATE TABLE IF NOT EXISTS public.class_permissions (
  class_name TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_name, permission_id)
);

-- Enable RLS
ALTER TABLE public.class_permissions ENABLE ROW LEVEL SECURITY;

-- Policies: public read, admins manage (aligned with other perms tables)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'class_permissions' AND policyname = 'Public read class perms'
  ) THEN
    CREATE POLICY "Public read class perms" ON public.class_permissions
    FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'class_permissions' AND policyname = 'Admins manage class perms'
  ) THEN
    CREATE POLICY "Admins manage class perms" ON public.class_permissions
    FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Trigger to update updated_at on change
CREATE OR REPLACE FUNCTION public.update_updated_at_class_permissions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_class_permissions_updated_at ON public.class_permissions;
CREATE TRIGGER trg_update_class_permissions_updated_at
BEFORE UPDATE ON public.class_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_class_permissions();