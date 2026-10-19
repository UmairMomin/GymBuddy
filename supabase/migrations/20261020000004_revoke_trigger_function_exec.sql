-- Trigger functions are only ever invoked by their triggers. Supabase's default privileges grant EXECUTE
-- on new public functions to authenticated/service_role, so revoke it explicitly. (Found by
-- supabase/tests/rls_audit.sql; Postgres already refuses to run them outside a trigger, this is hygiene.)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_single_buddy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workout_sets_stamp() FROM PUBLIC, anon, authenticated;
