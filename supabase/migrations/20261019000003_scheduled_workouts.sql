-- ==============================================================================
-- SCHEDULED WORKOUTS SCHEMA & RLS
-- Migration: 20261019000003_scheduled_workouts.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  routine_version_id UUID REFERENCES public.routine_versions(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'missed')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Workspace members can view scheduled workouts
CREATE POLICY "Members can view scheduled workouts in their workspace"
  ON public.scheduled_workouts FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
  );

-- 2. INSERT: Workspace members can schedule workouts
CREATE POLICY "Members can schedule workouts in their workspace"
  ON public.scheduled_workouts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id, auth.uid()) AND created_by = auth.uid()
  );

-- 3. UPDATE: Members can update scheduled workout status or notes
CREATE POLICY "Members can update scheduled workouts"
  ON public.scheduled_workouts FOR UPDATE
  TO authenticated
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
  );

-- 4. DELETE: Creator or workspace admin can delete scheduled workouts
CREATE POLICY "Creator or admin can delete scheduled workouts"
  ON public.scheduled_workouts FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid())
  );
