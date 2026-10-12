-- Allow viewing standard global exercises (workspace_id IS NULL) even before sign-in, and custom exercises when member
DROP POLICY IF EXISTS "Users can view standard or their workspace exercises" ON public.exercises;
CREATE POLICY "Users can view standard or their workspace exercises"
  ON public.exercises FOR SELECT
  TO authenticated, anon
  USING (
    workspace_id IS NULL OR (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );
