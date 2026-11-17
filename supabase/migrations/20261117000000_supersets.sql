-- Supersets: an exercise can be paired with another one on the same list. Both rows share a group id
-- (nothing else is stored; the app clears a group that is left with one exercise). Routines keep the id
-- inside routine_versions.structure_json, so only workout lists need a column. RLS is unchanged: the
-- existing "manage own" policy on session_exercises already covers it.
ALTER TABLE public.session_exercises ADD COLUMN IF NOT EXISTS superset_group UUID;

-- Starting from a routine copies each exercise's superset group (older routine versions have none).
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
      (session_id, user_id, exercise_id, position, target_sets, rep_min, rep_max, superset_group)
    SELECT p_session_id, v_me, e.exercise_id, e.position, COALESCE(e.target_sets, 3),
           e.rep_min, e.rep_max, e.superset_group
      FROM jsonb_to_recordset(v_structure) AS e(
        exercise_id UUID, position INT, target_sets INT, rep_min INT, rep_max INT, superset_group UUID);
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

-- Joining copies the host's list, including how it is paired (the joiner can change their own).
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
      (session_id, user_id, exercise_id, position, target_sets, rep_min, rep_max, superset_group)
    SELECT session_id, v_me, exercise_id, position, target_sets, rep_min, rep_max, superset_group
      FROM public.session_exercises
     WHERE session_id = p_session_id AND user_id = v_host AND skipped = false;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.start_workout_session(UUID, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_workout_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_workout_session(UUID, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_workout_session(UUID) TO authenticated;
