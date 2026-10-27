-- The number of sets is personal: a member may only delete their own sets. Weight, reps and
-- completion stay mutually editable (either person can correct the other's values).
DROP POLICY IF EXISTS "Sets: members delete" ON public.workout_sets;

CREATE POLICY "Sets: owner delete" ON public.workout_sets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_session_member(session_id));
