-- ==============================================================================
-- EXERCISES UPDATE AND DELETE RLS POLICIES
-- Migration: 20261012000003_exercise_update_delete_policies.sql
-- ==============================================================================

CREATE POLICY "Members can update custom exercises for their workspace"
  ON public.exercises FOR UPDATE
  TO authenticated
  USING (
    is_custom = true AND workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_custom = true AND workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "Members can delete custom exercises for their workspace"
  ON public.exercises FOR DELETE
  TO authenticated
  USING (
    is_custom = true AND workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())
  );
