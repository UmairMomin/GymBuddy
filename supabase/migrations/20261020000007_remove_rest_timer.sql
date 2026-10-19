-- ==============================================================================
-- Remove the rest timer feature: no rest_seconds on routines or workouts.
-- Rewrites the three functions that copied it, then drops the column. Routine versions saved earlier may
-- still carry a stale "rest_seconds" key in structure_json; every reader ignores unknown keys.
-- ==============================================================================

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
      (session_id, user_id, exercise_id, position, target_sets, rep_min, rep_max)
    SELECT p_session_id, v_me, e.exercise_id, e.position, COALESCE(e.target_sets, 3),
           e.rep_min, e.rep_max
      FROM jsonb_to_recordset(v_structure) AS e(
        exercise_id UUID, position INT, target_sets INT, rep_min INT, rep_max INT);
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
      (session_id, user_id, exercise_id, position, target_sets, rep_min, rep_max)
    SELECT session_id, v_me, exercise_id, position, target_sets, rep_min, rep_max
      FROM public.session_exercises
     WHERE session_id = p_session_id AND user_id = v_host AND skipped = false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.seed_starter_plan()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_defs JSONB := '[
    {"name":"Push","days":[0,3],"items":[
      ["Barbell Bench Press",4,6,8],["Incline Dumbbell Press",4,8,10],
      ["Seated Dumbbell Shoulder Press",3,8,10],["Dumbbell Lateral Raise",3,12,15],
      ["Tricep Rope Pushdown",3,10,12],["Overhead Tricep Extension",3,10,12]]},
    {"name":"Pull","days":[1,4],"items":[
      ["Pull-Up",4,6,10],["Barbell Bent-Over Row",4,8,10],["Seated Cable Row",3,10,12],
      ["Lat Pulldown",3,10,12],["Face Pull",3,12,15],["Hammer Curl",3,10,12]]},
    {"name":"Legs","days":[2],"items":[
      ["Barbell Back Squat",4,6,8],["Romanian Deadlift",3,8,10],["Leg Press",3,10,12],
      ["Leg Extension",3,12,15],["Lying Leg Curl",3,12,15],["Standing Calf Raise",4,12,15]]},
    {"name":"Shoulders + Arms","days":[5],"items":[
      ["Standing Overhead Press",4,6,8],["Dumbbell Lateral Raise",4,12,15],["Rear Delt Fly",3,12,15],
      ["Barbell Bicep Curl",3,8,10],["Incline Dumbbell Curl",3,10,12],
      ["Skull Crusher",3,8,10],["Tricep Rope Pushdown",3,10,12]]}
  ]';
  v_def JSONB;
  v_structure JSONB;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.routines WHERE owner_id = v_me AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'You already have routines';
  END IF;

  FOR v_def IN SELECT * FROM jsonb_array_elements(v_defs) LOOP
    SELECT jsonb_agg(jsonb_build_object(
             'exercise_id', e.id,
             'position', (i.ord - 1),
             'target_sets', (i.item->>1)::int,
             'rep_min', (i.item->>2)::int,
             'rep_max', (i.item->>3)::int) ORDER BY i.ord)
      INTO v_structure
      FROM jsonb_array_elements(v_def->'items') WITH ORDINALITY AS i(item, ord)
      JOIN public.exercises e ON e.owner_id IS NULL AND lower(e.name) = lower(i.item->>0);

    PERFORM public.save_routine(
      gen_random_uuid(),
      v_def->>'name',
      NULL,
      COALESCE(v_structure, '[]'::jsonb),
      ARRAY(SELECT jsonb_array_elements_text(v_def->'days')::smallint)
    );
  END LOOP;

  -- Make the rest day explicit.
  INSERT INTO public.weekly_schedule (user_id, weekday, routine_id)
  VALUES (v_me, 6, NULL)
  ON CONFLICT (user_id, weekday) DO NOTHING;
END $$;

ALTER TABLE public.session_exercises DROP COLUMN IF EXISTS rest_seconds;

REVOKE ALL ON FUNCTION public.start_workout_session(UUID, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_workout_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_starter_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_workout_session(UUID, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_workout_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_starter_plan() TO authenticated;
