-- Remove class_permissions table as it's not needed
DROP TABLE IF EXISTS public.class_permissions CASCADE;

-- Remove the trigger function as well
DROP FUNCTION IF EXISTS public.update_updated_at_class_permissions() CASCADE;