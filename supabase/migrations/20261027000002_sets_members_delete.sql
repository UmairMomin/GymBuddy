-- Either person may add or remove a set in either list ("both of us" / buddy tab), so deleting a set
-- is open to session members again. Reverts the owner-only delete from 20261027000001.
DROP POLICY IF EXISTS "Sets: owner delete" ON public.workout_sets;
CREATE POLICY "Sets: members delete" ON public.workout_sets
  FOR DELETE TO authenticated USING (public.is_session_member(session_id));
