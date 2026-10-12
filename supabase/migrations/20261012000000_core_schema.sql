-- ==============================================================================
-- GYM TRACKER - INITIAL CORE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Migration: 20261012000000_core_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PUBLIC PROFILES TABLE
-- Mirrors supabase auth.users for display names and preferences
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-sync profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS policies
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. WORKSPACES (Training Groups)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 4. WORKSPACE MEMBERS (Membership & Roles)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspace membership lookup helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Workspaces RLS policies
CREATE POLICY "Members can view workspaces they belong to"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(id, auth.uid()) OR created_by = auth.uid()
  );

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners and admins can update workspaces"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspaces.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Workspace Members RLS policies
CREATE POLICY "Members can view other members in the same workspace"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "Admins or owners can manage members"
  ON public.workspace_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = workspace_members.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- 5. EXERCISES CATALOG
CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE, -- NULL if global standard exercise
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body', 'other')),
  primary_equipment TEXT CHECK (primary_equipment IN ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'other')),
  notes TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view standard or their workspace exercises"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "Members can create custom exercises for their workspace"
  ON public.exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())
  );

-- 6. ROUTINES & ROUTINE VERSIONS
CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.routine_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  structure_json JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of planned exercises and target sets/reps
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (routine_id, version_number)
);

ALTER TABLE public.routine_versions ENABLE ROW LEVEL SECURITY;

-- Routines & Versions RLS
CREATE POLICY "Members can view workspace routines"
  ON public.routines FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can create routines in their workspace"
  ON public.routines FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can view routine versions"
  ON public.routine_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_versions.routine_id
        AND public.is_workspace_member(r.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Members can create routine versions"
  ON public.routine_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_versions.routine_id
        AND public.is_workspace_member(r.workspace_id, auth.uid())
    )
  );

-- 7. WORKOUT SESSIONS & PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  routine_version_id UUID REFERENCES public.routine_versions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'cancelled')) DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT
);

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, user_id)
);

ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- Session RLS
CREATE POLICY "Workspace members can view workout sessions"
  ON public.workout_sessions FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create workout sessions"
  ON public.workout_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update workout sessions"
  ON public.workout_sessions FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Participants can view session participant list"
  ON public.session_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = session_participants.session_id
        AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Members can join as session participants"
  ON public.session_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = session_participants.session_id
        AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

-- 8. WORKOUT SET RECORDS (Individual tracking & collaborative edits)
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Whose set performance this is
  set_order INT NOT NULL,
  set_type TEXT NOT NULL CHECK (set_type IN ('warmup', 'normal', 'drop', 'failure')) DEFAULT 'normal',
  weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  reps INT NOT NULL DEFAULT 0,
  rpe NUMERIC(3, 1),
  completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  logged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT, -- Who typed/logged this set
  revision_number INT NOT NULL DEFAULT 1, -- OCC revision check
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

-- Sets RLS (Shared logging enabled for workspace members)
CREATE POLICY "Workspace members can view sets of the session"
  ON public.workout_sets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = workout_sets.session_id
        AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Workspace members can insert sets for participants in the session"
  ON public.workout_sets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = workout_sets.session_id
        AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Workspace members can collaboratively update sets in the session"
  ON public.workout_sets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = workout_sets.session_id
        AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Workspace members can delete sets in the session"
  ON public.workout_sets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = workout_sets.session_id
        AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

-- 9. PRE-SEED STANDARD EXERCISES
INSERT INTO public.exercises (name, category, primary_equipment, is_custom) VALUES
  ('Barbell Bench Press', 'chest', 'barbell', false),
  ('Incline Dumbbell Press', 'chest', 'dumbbell', false),
  ('Chest Dip', 'chest', 'bodyweight', false),
  ('Barbell Back Squat', 'legs', 'barbell', false),
  ('Romanian Deadlift', 'legs', 'barbell', false),
  ('Leg Press', 'legs', 'machine', false),
  ('Standing Overhead Press', 'shoulders', 'barbell', false),
  ('Dumbbell Lateral Raise', 'shoulders', 'dumbbell', false),
  ('Barbell Deadlift', 'back', 'barbell', false),
  ('Pull-Up', 'back', 'bodyweight', false),
  ('Barbell Bent-Over Row', 'back', 'barbell', false),
  ('Lat Pulldown', 'back', 'cable', false),
  ('Barbell Bicep Curl', 'arms', 'barbell', false),
  ('Tricep Rope Pushdown', 'arms', 'cable', false),
  ('Hanging Leg Raise', 'core', 'bodyweight', false),
  ('Plank', 'core', 'bodyweight', false)
ON CONFLICT DO NOTHING;
