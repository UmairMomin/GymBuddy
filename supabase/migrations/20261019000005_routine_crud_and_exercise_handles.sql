-- ==============================================================================
-- ROUTINE CRUD, DAY OF WEEK & EXERCISE HANDLES
-- Migration: 20261019000005_routine_crud_and_exercise_handles.sql
-- ==============================================================================

-- 1. Add day_of_week to routines table
ALTER TABLE public.routines
ADD COLUMN IF NOT EXISTS day_of_week TEXT CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));

-- 2. Add handle_type to exercises table
ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS handle_type TEXT;

-- 3. Update category check constraint on exercises to include 'bicep' and 'tricep'
ALTER TABLE public.exercises
DROP CONSTRAINT IF EXISTS exercises_category_check;

ALTER TABLE public.exercises
ADD CONSTRAINT exercises_category_check
CHECK (category IN ('chest', 'back', 'legs', 'shoulders', 'bicep', 'tricep', 'arms', 'core', 'cardio', 'full_body', 'other'));

-- 4. Update existing 'arms' category into 'tricep' or 'bicep'
UPDATE public.exercises
SET category = 'tricep'
WHERE category = 'arms' AND (name ILIKE '%tricep%' OR name ILIKE '%pushdown%' OR name ILIKE '%skull%');

UPDATE public.exercises
SET category = 'bicep'
WHERE category = 'arms';

-- 5. Enable UPDATE and DELETE RLS policies on routines
DROP POLICY IF EXISTS "Members can update routines in their workspace" ON public.routines;
CREATE POLICY "Members can update routines in their workspace"
  ON public.routines FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Members can delete routines in their workspace" ON public.routines;
CREATE POLICY "Members can delete routines in their workspace"
  ON public.routines FOR DELETE
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 6. Enable DELETE RLS policy on routine_versions
DROP POLICY IF EXISTS "Members can delete routine versions" ON public.routine_versions;
CREATE POLICY "Members can delete routine versions"
  ON public.routine_versions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_versions.routine_id
        AND public.is_workspace_member(r.workspace_id, auth.uid())
    )
  );
