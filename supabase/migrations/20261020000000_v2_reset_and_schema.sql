-- ==============================================================================
-- GYM TRACKER V2 — CLEAN RESET + SOLO / BUDDY SCHEMA
-- Migration: 20261020000000_v2_reset_and_schema.sql
-- Authority: docs/V2_PRODUCT_DIRECTION.md (Milestone 15)
--
-- DESTRUCTIVE: drops every V1 table/function (workspaces, groups, scheduled_workouts,
-- session_events, ...) and DELETES ALL auth.users. V1 data was test data (owner-approved
-- on 2026-10-19). New model: solo tracker + one optional buddy (buddy_links).
--
-- Conventions
--   * weekday: 0 = Monday ... 6 = Sunday
--   * routine_versions.structure_json = [{exercise_id, position, target_sets,
--       rep_min, rep_max, rest_seconds}, ...]
--   * weights stored in kg; display unit is profiles.preferred_unit
--   * every multi-table write goes through a SECURITY DEFINER function in this file
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. RESET
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP POLICY IF EXISTS "Session members can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Session members can send realtime" ON realtime.messages;

DROP TABLE IF EXISTS
  public.session_events,
  public.workout_sets,
  public.session_exercises,
  public.session_participants,
  public.scheduled_workouts,
  public.workout_sessions,
  public.weekly_schedule,
  public.routine_versions,
  public.routines,
  public.body_metrics,
  public.push_subscriptions,
  public.buddy_links,
  public.exercises,
  public.workspace_members,
  public.workspaces,
  public.profiles
CASCADE;

-- Drop remaining app functions (skip anything owned by an extension).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

DELETE FROM auth.users;

-- ------------------------------------------------------------------------------
-- 1. SHARED HELPERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------
-- 2. PROFILES (no email stored: login email is an internal <username>@gymbuddy.local)
-- ------------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,30}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  avatar_url TEXT,
  preferred_unit TEXT NOT NULL DEFAULT 'kg' CHECK (preferred_unit IN ('kg', 'lb')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'));
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), v_username)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. BUDDY LINKS (1:1; at most one ACCEPTED link per user)
-- ------------------------------------------------------------------------------
CREATE TABLE public.buddy_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  responded_at TIMESTAMPTZ,
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX buddy_links_pair_uniq
  ON public.buddy_links (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX buddy_links_addressee_idx ON public.buddy_links (addressee_id);
CREATE INDEX buddy_links_requester_idx ON public.buddy_links (requester_id);
ALTER TABLE public.buddy_links ENABLE ROW LEVEL SECURITY;

-- Is `_other` linked (pending or accepted) with the caller?
CREATE OR REPLACE FUNCTION public.is_linked_with(_other UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buddy_links
    WHERE (requester_id = auth.uid() AND addressee_id = _other)
       OR (addressee_id = auth.uid() AND requester_id = _other)
  );
$$;

-- Are `_a` and `_b` accepted buddies?
CREATE OR REPLACE FUNCTION public.are_buddies(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buddy_links
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))
  );
$$;

CREATE OR REPLACE FUNCTION public.has_accepted_buddy(_user UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buddy_links
    WHERE status = 'accepted' AND (requester_id = _user OR addressee_id = _user)
  );
$$;

-- Backstop: never let either user hold two accepted links.
CREATE OR REPLACE FUNCTION public.enforce_single_buddy()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND EXISTS (
    SELECT 1 FROM public.buddy_links
    WHERE status = 'accepted' AND id <> NEW.id
      AND (requester_id IN (NEW.requester_id, NEW.addressee_id)
        OR addressee_id IN (NEW.requester_id, NEW.addressee_id))
  ) THEN
    RAISE EXCEPTION 'One of these users already has a buddy';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER buddy_links_single
  BEFORE INSERT OR UPDATE ON public.buddy_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_buddy();

-- Profiles RLS (own profile + anyone you have a buddy link with)
CREATE POLICY "Profiles: read self or linked buddy" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_linked_with(id));
CREATE POLICY "Profiles: update self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Buddy link RLS: parties read; either party may delete (decline/remove).
-- Create/accept go through the RPCs below, so there is no INSERT/UPDATE policy.
CREATE POLICY "Buddy links: parties can read" ON public.buddy_links
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "Buddy links: parties can delete" ON public.buddy_links
  FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Look a user up by exact username without exposing the profiles table.
CREATE OR REPLACE FUNCTION public.find_profile_by_username(p_username TEXT)
RETURNS TABLE (id UUID, username TEXT, display_name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name
  FROM public.profiles p
  WHERE p.username = lower(trim(p_username)) AND p.id <> auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.request_buddy(p_username TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_target UUID;
  v_id UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_target FROM public.profiles WHERE username = lower(trim(p_username));
  IF v_target IS NULL THEN RAISE EXCEPTION 'No user with that username'; END IF;
  IF v_target = v_me THEN RAISE EXCEPTION 'You cannot add yourself'; END IF;
  IF public.has_accepted_buddy(v_me) THEN RAISE EXCEPTION 'You already have a buddy'; END IF;
  IF public.has_accepted_buddy(v_target) THEN RAISE EXCEPTION 'That user already has a buddy'; END IF;
  IF public.is_linked_with(v_target) THEN RAISE EXCEPTION 'A request already exists with that user'; END IF;
  INSERT INTO public.buddy_links (requester_id, addressee_id) VALUES (v_me, v_target)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.accept_buddy(p_link_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link public.buddy_links;
BEGIN
  SELECT * INTO v_link FROM public.buddy_links
   WHERE id = p_link_id AND addressee_id = auth.uid() AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF public.has_accepted_buddy(v_link.requester_id) OR public.has_accepted_buddy(v_link.addressee_id) THEN
    RAISE EXCEPTION 'One of these users already has a buddy';
  END IF;
  UPDATE public.buddy_links SET status = 'accepted', responded_at = now() WHERE id = p_link_id;
  -- Other pending requests involving either user are now moot.
  DELETE FROM public.buddy_links
   WHERE status = 'pending' AND id <> p_link_id
     AND (requester_id IN (v_link.requester_id, v_link.addressee_id)
       OR addressee_id IN (v_link.requester_id, v_link.addressee_id));
END $$;

-- ------------------------------------------------------------------------------
-- 4. EXERCISES (system rows have owner_id NULL; custom rows are private to the owner)
-- ------------------------------------------------------------------------------
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  category TEXT NOT NULL CHECK (category IN
    ('chest', 'back', 'legs', 'shoulders', 'bicep', 'tricep', 'core', 'cardio', 'full_body', 'other')),
  primary_equipment TEXT CHECK (primary_equipment IN
    ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'other')),
  handle_type TEXT,
  notes TEXT,
  is_custom BOOLEAN GENERATED ALWAYS AS (owner_id IS NOT NULL) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE UNIQUE INDEX exercises_system_name_uniq ON public.exercises (lower(name)) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX exercises_owner_name_uniq ON public.exercises (owner_id, lower(name)) WHERE owner_id IS NOT NULL;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exercises: read system and own" ON public.exercises
  FOR SELECT TO authenticated USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "Exercises: insert own" ON public.exercises
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Exercises: update own" ON public.exercises
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Exercises: delete own" ON public.exercises
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 5. ROUTINES, VERSIONS, WEEKLY SCHEDULE (all private to the owner)
-- ------------------------------------------------------------------------------
CREATE TABLE public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX routines_owner_idx ON public.routines (owner_id);
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER routines_touch BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.routine_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  version_number INT NOT NULL CHECK (version_number >= 1),
  structure_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(structure_json) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (routine_id, version_number)
);
ALTER TABLE public.routine_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.weekly_schedule (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL, -- NULL = rest day
  PRIMARY KEY (user_id, weekday)
);
ALTER TABLE public.weekly_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Routines: owner full access" ON public.routines
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Routine versions: owner read" ON public.routine_versions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_id AND r.owner_id = auth.uid()));
-- Versions are immutable and written only by save_routine().

CREATE POLICY "Schedule: owner read" ON public.weekly_schedule
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Schedule: owner write" ON public.weekly_schedule
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (routine_id IS NULL OR EXISTS (
      SELECT 1 FROM public.routines r WHERE r.id = routine_id AND r.owner_id = auth.uid()))
  );

-- Create or update a routine, append an immutable version, and assign weekdays — atomically.
-- Idempotent on p_routine_id (client-generated).
CREATE OR REPLACE FUNCTION public.save_routine(
  p_routine_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_structure JSONB,
  p_weekdays SMALLINT[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_owner UUID;
  v_next INT;
  v_day SMALLINT;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_typeof(p_structure) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'structure must be a JSON array';
  END IF;

  SELECT owner_id INTO v_owner FROM public.routines WHERE id = p_routine_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.routines (id, owner_id, name, description)
    VALUES (p_routine_id, v_me, p_name, p_description);
  ELSIF v_owner <> v_me THEN
    RAISE EXCEPTION 'Not your routine';
  ELSE
    UPDATE public.routines SET name = p_name, description = p_description WHERE id = p_routine_id;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
    FROM public.routine_versions WHERE routine_id = p_routine_id;
  INSERT INTO public.routine_versions (routine_id, version_number, structure_json)
  VALUES (p_routine_id, v_next, p_structure);

  -- Weekdays: clear days that used to point here, then claim the requested ones.
  DELETE FROM public.weekly_schedule
   WHERE user_id = v_me AND routine_id = p_routine_id
     AND NOT (weekday = ANY (COALESCE(p_weekdays, ARRAY[]::SMALLINT[])));
  FOREACH v_day IN ARRAY COALESCE(p_weekdays, ARRAY[]::SMALLINT[]) LOOP
    IF v_day NOT BETWEEN 0 AND 6 THEN RAISE EXCEPTION 'Invalid weekday %', v_day; END IF;
    INSERT INTO public.weekly_schedule (user_id, weekday, routine_id)
    VALUES (v_me, v_day, p_routine_id)
    ON CONFLICT (user_id, weekday) DO UPDATE SET routine_id = EXCLUDED.routine_id;
  END LOOP;

  RETURN p_routine_id;
END $$;

-- ------------------------------------------------------------------------------
-- 6. WORKOUT SESSIONS, PARTICIPANTS, PER-PERSON EXERCISE LISTS, SETS
-- ------------------------------------------------------------------------------
CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  routine_version_id UUID REFERENCES public.routine_versions(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ,
  notes TEXT
);
-- A host can run only one live session at a time.
CREATE UNIQUE INDEX workout_sessions_one_live_per_host
  ON public.workout_sessions (host_id) WHERE status = 'in_progress';
CREATE INDEX workout_sessions_host_idx ON public.workout_sessions (host_id, started_at DESC);
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'joined', 'declined', 'left')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, user_id)
);
CREATE INDEX session_participants_user_idx ON public.session_participants (user_id, status);
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- Session membership helpers (SECURITY DEFINER avoids RLS recursion between the tables).
-- "Member" = host, or a participant who joined (and may since have left). Members see sets.
CREATE OR REPLACE FUNCTION public.is_session_member(_session UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = _session AND s.host_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.session_participants p
                 WHERE p.session_id = _session AND p.user_id = auth.uid() AND p.status IN ('joined', 'left'));
$$;

-- "Can see the session header": members plus a pending invitee (who must see it to Join/Decline,
-- but does NOT see sets until they join).
CREATE OR REPLACE FUNCTION public.can_view_session(_session UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.is_session_member(_session)
      OR EXISTS (SELECT 1 FROM public.session_participants p
                 WHERE p.session_id = _session AND p.user_id = auth.uid() AND p.status = 'invited');
$$;

CREATE POLICY "Sessions: members and invitees read" ON public.workout_sessions
  FOR SELECT TO authenticated USING (public.can_view_session(id));
-- Writes happen through the RPCs below (start/join/finish); host may also edit name/notes.
CREATE POLICY "Sessions: host update" ON public.workout_sessions
  FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "Sessions: host delete" ON public.workout_sessions
  FOR DELETE TO authenticated USING (host_id = auth.uid());

CREATE POLICY "Participants: read for session viewers" ON public.session_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_view_session(session_id));

CREATE TABLE public.session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- whose list this is
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  position INT NOT NULL CHECK (position >= 0),
  target_sets INT NOT NULL DEFAULT 3 CHECK (target_sets BETWEEN 0 AND 20),
  rep_min INT CHECK (rep_min >= 0),
  rep_max INT CHECK (rep_max >= 0),
  rest_seconds INT CHECK (rest_seconds BETWEEN 0 AND 1800),
  skipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX session_exercises_session_idx ON public.session_exercises (session_id, user_id, position);
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- client-generated for idempotent writes
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- whose performance
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  set_order INT NOT NULL CHECK (set_order >= 1),
  set_type TEXT NOT NULL DEFAULT 'normal' CHECK (set_type IN ('warmup', 'normal', 'drop', 'failure')),
  weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
  reps INT NOT NULL DEFAULT 0 CHECK (reps >= 0),
  rpe NUMERIC(3, 1) CHECK (rpe BETWEEN 0 AND 10),
  completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  last_edited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  revision_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX workout_sets_session_idx ON public.workout_sets (session_id, user_id, exercise_id, set_order);
CREATE INDEX workout_sets_user_exercise_idx ON public.workout_sets (user_id, exercise_id);
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

-- Stamp editor + bump revision on every write. Clients do compare-and-swap with
--   UPDATE ... WHERE id = $1 AND revision_number = $expected
-- so a stale writer matches zero rows and must refetch (no silent overwrite).
CREATE OR REPLACE FUNCTION public.workout_sets_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.last_edited_by := auth.uid();
    NEW.revision_number := 1;
  ELSE
    IF NEW.session_id <> OLD.session_id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'session_id and user_id are immutable';
    END IF;
    NEW.last_edited_by := auth.uid();
    NEW.revision_number := OLD.revision_number + 1;
    NEW.updated_at := timezone('utc'::text, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workout_sets_stamp_trg
  BEFORE INSERT OR UPDATE ON public.workout_sets
  FOR EACH ROW EXECUTE FUNCTION public.workout_sets_stamp();

-- Sets: any member may read/insert/update/delete — including after the session is finished
-- (mutual editing, no locking). A set may only belong to a host or a joined/left participant.
CREATE OR REPLACE FUNCTION public.is_session_member_user(_session UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = _session AND s.host_id = _user)
      OR EXISTS (SELECT 1 FROM public.session_participants p
                 WHERE p.session_id = _session AND p.user_id = _user AND p.status IN ('joined', 'left'));
$$;

CREATE POLICY "Sets: members read" ON public.workout_sets
  FOR SELECT TO authenticated USING (public.is_session_member(session_id));
CREATE POLICY "Sets: members insert" ON public.workout_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_session_member(session_id) AND public.is_session_member_user(session_id, user_id));
CREATE POLICY "Sets: members update" ON public.workout_sets
  FOR UPDATE TO authenticated
  USING (public.is_session_member(session_id))
  WITH CHECK (public.is_session_member(session_id) AND public.is_session_member_user(session_id, user_id));
CREATE POLICY "Sets: members delete" ON public.workout_sets
  FOR DELETE TO authenticated USING (public.is_session_member(session_id));

-- Per-person exercise lists: members read all; each person manages only their own list.
CREATE POLICY "Session exercises: members read" ON public.session_exercises
  FOR SELECT TO authenticated USING (public.is_session_member(session_id));
CREATE POLICY "Session exercises: manage own" ON public.session_exercises
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_session_member(session_id))
  WITH CHECK (user_id = auth.uid() AND public.is_session_member(session_id));

-- ---- Session lifecycle RPCs (transactional) ---------------------------------

-- Start a session from a routine (or freestyle when p_routine_id IS NULL).
-- Snapshots the routine's latest version, builds the host's exercise list, and (optionally)
-- invites the accepted buddy. Idempotent on p_session_id.
CREATE OR REPLACE FUNCTION public.start_workout_session(
  p_session_id UUID,
  p_name TEXT,
  p_routine_id UUID,
  p_with_buddy BOOLEAN
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_version_id UUID;
  v_structure JSONB;
  v_buddy UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.workout_sessions WHERE id = p_session_id AND host_id = v_me) THEN
    RETURN p_session_id;
  END IF;

  IF p_routine_id IS NOT NULL THEN
    SELECT v.id, v.structure_json INTO v_version_id, v_structure
      FROM public.routine_versions v
      JOIN public.routines r ON r.id = v.routine_id
     WHERE r.id = p_routine_id AND r.owner_id = v_me
     ORDER BY v.version_number DESC LIMIT 1;
    IF v_version_id IS NULL THEN RAISE EXCEPTION 'Routine not found'; END IF;
  END IF;

  INSERT INTO public.workout_sessions (id, host_id, routine_id, routine_version_id, name)
  VALUES (p_session_id, v_me, p_routine_id, v_version_id, p_name);

  INSERT INTO public.session_participants (session_id, user_id, status, invited_by, joined_at)
  VALUES (p_session_id, v_me, 'joined', v_me, now());

  IF v_structure IS NOT NULL THEN
    INSERT INTO public.session_exercises
      (session_id, user_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
    SELECT p_session_id, v_me, e.exercise_id, e.position, COALESCE(e.target_sets, 3),
           e.rep_min, e.rep_max, e.rest_seconds
      FROM jsonb_to_recordset(v_structure) AS e(
        exercise_id UUID, position INT, target_sets INT, rep_min INT, rep_max INT, rest_seconds INT);
  END IF;

  IF p_with_buddy THEN
    SELECT CASE WHEN requester_id = v_me THEN addressee_id ELSE requester_id END INTO v_buddy
      FROM public.buddy_links
     WHERE status = 'accepted' AND (requester_id = v_me OR addressee_id = v_me);
    IF v_buddy IS NOT NULL THEN
      INSERT INTO public.session_participants (session_id, user_id, status, invited_by)
      VALUES (p_session_id, v_buddy, 'invited', v_me);
    END IF;
  END IF;

  RETURN p_session_id;
END $$;

-- Invite the buddy into an already-running session (e.g. they arrive later).
CREATE OR REPLACE FUNCTION public.invite_buddy_to_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_buddy UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workout_sessions
                  WHERE id = p_session_id AND host_id = v_me AND status = 'in_progress') THEN
    RAISE EXCEPTION 'Only the host of a live session can invite';
  END IF;
  SELECT CASE WHEN requester_id = v_me THEN addressee_id ELSE requester_id END INTO v_buddy
    FROM public.buddy_links
   WHERE status = 'accepted' AND (requester_id = v_me OR addressee_id = v_me);
  IF v_buddy IS NULL THEN RAISE EXCEPTION 'You have no buddy yet'; END IF;
  INSERT INTO public.session_participants (session_id, user_id, status, invited_by)
  VALUES (p_session_id, v_buddy, 'invited', v_me)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET status = 'invited', invited_by = v_me
    WHERE public.session_participants.status IN ('declined', 'left');
END $$;

-- Join (explicit confirmation step). Copies the host's exercise list as the joiner's own.
CREATE OR REPLACE FUNCTION public.join_workout_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_host UUID;
BEGIN
  SELECT host_id INTO v_host FROM public.workout_sessions
   WHERE id = p_session_id AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'Session is not live'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.session_participants
                  WHERE session_id = p_session_id AND user_id = v_me
                    AND status IN ('invited', 'left')) THEN
    RAISE EXCEPTION 'No invitation for this session';
  END IF;
  UPDATE public.session_participants
     SET status = 'joined', joined_at = COALESCE(joined_at, now()), completed_at = NULL
   WHERE session_id = p_session_id AND user_id = v_me;
  IF NOT EXISTS (SELECT 1 FROM public.session_exercises WHERE session_id = p_session_id AND user_id = v_me) THEN
    INSERT INTO public.session_exercises
      (session_id, user_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
    SELECT session_id, v_me, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds
      FROM public.session_exercises
     WHERE session_id = p_session_id AND user_id = v_host AND skipped = false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.decline_workout_session(p_session_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.session_participants SET status = 'declined'
   WHERE session_id = p_session_id AND user_id = auth.uid() AND status = 'invited';
$$;

CREATE OR REPLACE FUNCTION public.leave_workout_session(p_session_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.session_participants SET status = 'left', completed_at = COALESCE(completed_at, now())
   WHERE session_id = p_session_id AND user_id = auth.uid() AND status = 'joined'
     AND NOT EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = p_session_id AND s.host_id = auth.uid());
$$;

-- A participant marks their own part done (does not end the session for the other person).
CREATE OR REPLACE FUNCTION public.finish_my_workout(p_session_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.session_participants SET completed_at = COALESCE(completed_at, now())
   WHERE session_id = p_session_id AND user_id = auth.uid() AND status = 'joined';
$$;

-- Host ends the whole session; everyone still joined is marked complete.
CREATE OR REPLACE FUNCTION public.finish_workout_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.workout_sessions SET status = 'completed', ended_at = now()
   WHERE id = p_session_id AND host_id = auth.uid() AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the host can finish a live session'; END IF;
  UPDATE public.session_participants SET completed_at = COALESCE(completed_at, now())
   WHERE session_id = p_session_id AND status = 'joined';
  UPDATE public.session_participants SET status = 'declined'
   WHERE session_id = p_session_id AND status = 'invited';
END $$;

-- ------------------------------------------------------------------------------
-- 7. PRIVATE USER DATA
-- ------------------------------------------------------------------------------
CREATE TABLE public.body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0),
  body_fat_percentage NUMERIC(4, 1) CHECK (body_fat_percentage BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX body_metrics_user_idx ON public.body_metrics (user_id, recorded_date DESC);
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Body metrics: owner only" ON public.body_metrics
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Push subscriptions: owner only" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 8. FUNCTION PRIVILEGES (no anonymous / public execution)
-- ------------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon';
    -- Trigger functions are never called by clients.
    IF r.proname NOT IN ('handle_new_user', 'touch_updated_at', 'enforce_single_buddy', 'workout_sets_stamp') THEN
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated';
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 9. REALTIME
-- Private channels: topic "session:<uuid>" is joinable only by session members.
-- postgres_changes respect the table RLS above (invitees get their own participant row).
-- ------------------------------------------------------------------------------
ALTER TABLE public.workout_sets REPLICA IDENTITY FULL;
ALTER TABLE public.session_participants REPLICA IDENTITY FULL;
ALTER TABLE public.session_exercises REPLICA IDENTITY FULL;
ALTER TABLE public.workout_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.buddy_links REPLICA IDENTITY FULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['workout_sets', 'session_participants', 'session_exercises', 'workout_sessions', 'buddy_links']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

CREATE POLICY "Session members can receive realtime" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() ~ '^session:[0-9a-f-]{36}$'
    AND public.is_session_member(substring(realtime.topic() FROM 9)::uuid)
  );
CREATE POLICY "Session members can send realtime" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() ~ '^session:[0-9a-f-]{36}$'
    AND public.is_session_member(substring(realtime.topic() FROM 9)::uuid)
  );

-- ------------------------------------------------------------------------------
-- 10. SEED: system exercises
-- ------------------------------------------------------------------------------
INSERT INTO public.exercises (name, category, primary_equipment) VALUES
  ('Barbell Bench Press', 'chest', 'barbell'),
  ('Incline Dumbbell Press', 'chest', 'dumbbell'),
  ('Incline Barbell Press', 'chest', 'barbell'),
  ('Dumbbell Bench Press', 'chest', 'dumbbell'),
  ('Cable Fly', 'chest', 'cable'),
  ('Pec Deck', 'chest', 'machine'),
  ('Chest Dip', 'chest', 'bodyweight'),
  ('Push-Up', 'chest', 'bodyweight'),
  ('Barbell Deadlift', 'back', 'barbell'),
  ('Pull-Up', 'back', 'bodyweight'),
  ('Barbell Bent-Over Row', 'back', 'barbell'),
  ('Seated Cable Row', 'back', 'cable'),
  ('One-Arm Dumbbell Row', 'back', 'dumbbell'),
  ('Lat Pulldown', 'back', 'cable'),
  ('Face Pull', 'back', 'cable'),
  ('Barbell Back Squat', 'legs', 'barbell'),
  ('Romanian Deadlift', 'legs', 'barbell'),
  ('Leg Press', 'legs', 'machine'),
  ('Leg Extension', 'legs', 'machine'),
  ('Lying Leg Curl', 'legs', 'machine'),
  ('Walking Lunge', 'legs', 'dumbbell'),
  ('Standing Calf Raise', 'legs', 'machine'),
  ('Standing Overhead Press', 'shoulders', 'barbell'),
  ('Seated Dumbbell Shoulder Press', 'shoulders', 'dumbbell'),
  ('Dumbbell Lateral Raise', 'shoulders', 'dumbbell'),
  ('Rear Delt Fly', 'shoulders', 'dumbbell'),
  ('Barbell Shrug', 'shoulders', 'barbell'),
  ('Barbell Bicep Curl', 'bicep', 'barbell'),
  ('Incline Dumbbell Curl', 'bicep', 'dumbbell'),
  ('Hammer Curl', 'bicep', 'dumbbell'),
  ('Preacher Curl', 'bicep', 'machine'),
  ('Tricep Rope Pushdown', 'tricep', 'cable'),
  ('Skull Crusher', 'tricep', 'barbell'),
  ('Overhead Tricep Extension', 'tricep', 'cable'),
  ('Close-Grip Bench Press', 'tricep', 'barbell'),
  ('Hanging Leg Raise', 'core', 'bodyweight'),
  ('Cable Crunch', 'core', 'cable'),
  ('Plank', 'core', 'bodyweight');
