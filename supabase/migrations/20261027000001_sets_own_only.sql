-- Sets are personal: a member may still read everyone's sets in the session, but only change or
-- delete their own. (Was: any member could edit or delete the other person's sets.)
DROP POLICY IF EXISTS "Sets: members update" ON public.workout_sets;
DROP POLICY IF EXISTS "Sets: members delete" ON public.workout_sets;

CREATE POLICY "Sets: owner update" ON public.workout_sets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_session_member(session_id))
  WITH CHECK (user_id = auth.uid() AND public.is_session_member(session_id));
CREATE POLICY "Sets: owner delete" ON public.workout_sets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_session_member(session_id));
