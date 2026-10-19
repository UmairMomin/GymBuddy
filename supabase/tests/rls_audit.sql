-- Structural security audit (Milestone 22). Run after every migration; expect error text 'ALL_PASSED'.
-- Behavioural policy tests live in the other files in this folder; this one checks invariants that must
-- hold for ANY table or function, so a new migration cannot quietly weaken them.
DO $audit$
DECLARE
  r RECORD;
  problems TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 1. Every public table has RLS enabled and at least one policy.
  FOR r IN
    SELECT c.relname, c.relrowsecurity,
           (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    IF NOT r.relrowsecurity THEN problems := problems || format('table %s has RLS disabled', r.relname); END IF;
    IF r.policies = 0 THEN problems := problems || format('table %s has no policies (deny-all is fine only if intended)', r.relname); END IF;
  END LOOP;

  -- 2. No policy applies to PUBLIC or anon, and none is a blanket "true" that grants writes.
  FOR r IN SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname IN ('public', 'realtime') AND (schemaname = 'public' OR tablename = 'messages')
  LOOP
    IF r.roles && ARRAY['public'::name, 'anon'::name] THEN
      problems := problems || format('policy "%s" on %s applies to public/anon', r.policyname, r.tablename);
    END IF;
    IF r.cmd <> 'SELECT' AND (r.qual = 'true' OR r.with_check = 'true') THEN
      problems := problems || format('policy "%s" on %s grants unconditional %s', r.policyname, r.tablename, r.cmd);
    END IF;
    IF r.cmd = 'SELECT' AND r.qual = 'true' THEN
      problems := problems || format('policy "%s" on %s exposes every row to every signed-in user', r.policyname, r.tablename);
    END IF;
  END LOOP;

  -- 3. Functions: SECURITY DEFINER must pin search_path; nothing is executable by anon/PUBLIC.
  FOR r IN
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    IF r.prosecdef AND NOT COALESCE(r.proconfig::text ILIKE '%search_path%', false) THEN
      problems := problems || format('SECURITY DEFINER function %s(%s) has no fixed search_path', r.proname, r.args);
    END IF;
    IF has_function_privilege('anon', r.oid, 'EXECUTE') THEN
      problems := problems || format('function %s(%s) is executable by anon', r.proname, r.args);
    END IF;
    IF r.proname IN ('handle_new_user', 'touch_updated_at', 'enforce_single_buddy', 'workout_sets_stamp')
       AND has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      problems := problems || format('trigger function %s is callable by clients', r.proname);
    END IF;
  END LOOP;

  -- 4. Realtime: only RLS-protected tables are published; message policies exist.
  FOR r IN SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', r.tablename)::regclass) THEN
      problems := problems || format('published table %s has RLS disabled', r.tablename);
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages') < 2 THEN
    problems := problems || 'realtime.messages is missing its session channel policies';
  END IF;

  -- 5. Data minimisation: profiles must not store the internal login email.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
    problems := problems || 'profiles has an email column';
  END IF;

  -- 6. No V1 leftovers.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('workspaces', 'workspace_members', 'scheduled_workouts', 'session_events')) THEN
    problems := problems || 'V1 tables still exist';
  END IF;

  IF array_length(problems, 1) > 0 THEN
    RAISE EXCEPTION 'AUDIT FAILED: %', array_to_string(problems, '; ');
  END IF;
  RAISE EXCEPTION 'ALL_PASSED';
END
$audit$;
