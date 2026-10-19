-- Solo workout flow (Milestone 18). Rolled back; expect error text 'ALL_PASSED'.
DO $test$
DECLARE
  a UUID := gen_random_uuid(); r UUID; s1 UUID := gen_random_uuid(); s2 UUID := gen_random_uuid();
  ex UUID; set1 UUID := gen_random_uuid(); n INT; rev INT; w NUMERIC; rows INT;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (a, 'tw_' || left(a::text, 6) || '@gymbuddy.local', '{}');
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  PERFORM public.seed_starter_plan();
  SELECT id INTO r FROM public.routines WHERE owner_id = a AND name = 'Push';

  -- Start from routine: host row + exercise list copied from the latest version
  PERFORM public.start_workout_session(s1, 'Push', r, false);
  SELECT count(*) INTO n FROM public.session_exercises WHERE session_id = s1 AND user_id = a;
  IF n <> 6 THEN RAISE EXCEPTION 'FAIL: expected 6 session exercises, got %', n; END IF;
  SELECT count(*) INTO n FROM public.session_participants WHERE session_id = s1 AND status = 'joined';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: host not joined'; END IF;

  -- Idempotent start (retry with same id)
  PERFORM public.start_workout_session(s1, 'Push', r, false);
  SELECT count(*) INTO n FROM public.session_exercises WHERE session_id = s1;
  IF n <> 6 THEN RAISE EXCEPTION 'FAIL: retry duplicated exercises (%)', n; END IF;

  -- One live session per host (unique violation 23505)
  BEGIN
    PERFORM public.start_workout_session(s2, 'Second', NULL, false);
    RAISE EXCEPTION 'FAIL: second live session allowed';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- Sets: insert, duplicate id rejected (client turns this into "return stored row"), CAS update
  SELECT exercise_id INTO ex FROM public.session_exercises WHERE session_id = s1 ORDER BY position LIMIT 1;
  INSERT INTO public.workout_sets (id, session_id, user_id, exercise_id, set_order, weight_kg, reps, completed, last_edited_by)
    VALUES (set1, s1, a, ex, 1, 60, 8, true, a);
  BEGIN
    INSERT INTO public.workout_sets (id, session_id, user_id, exercise_id, set_order, last_edited_by)
      VALUES (set1, s1, a, ex, 1, a);
    RAISE EXCEPTION 'FAIL: duplicate set id accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  UPDATE public.workout_sets SET weight_kg = 62.5 WHERE id = set1 AND revision_number = 1;
  GET DIAGNOSTICS rows = ROW_COUNT;
  IF rows <> 1 THEN RAISE EXCEPTION 'FAIL: CAS update with correct revision matched % rows', rows; END IF;
  UPDATE public.workout_sets SET weight_kg = 70 WHERE id = set1 AND revision_number = 1; -- stale
  GET DIAGNOSTICS rows = ROW_COUNT;
  IF rows <> 0 THEN RAISE EXCEPTION 'FAIL: stale write was applied'; END IF;
  SELECT revision_number, weight_kg INTO rev, w FROM public.workout_sets WHERE id = set1;
  IF rev <> 2 OR w <> 62.5 THEN RAISE EXCEPTION 'FAIL: unexpected state rev=% w=%', rev, w; END IF;

  -- Add + skip exercise in own list
  INSERT INTO public.session_exercises (session_id, user_id, exercise_id, position, target_sets)
    SELECT s1, a, id, 99, 3 FROM public.exercises WHERE owner_id IS NULL AND name = 'Plank';
  UPDATE public.session_exercises SET skipped = true WHERE session_id = s1 AND user_id = a AND position = 99;

  -- Finish: ended + participant completed; sets stay editable afterwards
  PERFORM public.finish_workout_session(s1);
  SELECT count(*) INTO n FROM public.workout_sessions WHERE id = s1 AND status = 'completed' AND ended_at IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: session not completed'; END IF;
  UPDATE public.workout_sets SET reps = 9 WHERE id = set1 AND revision_number = 2;
  GET DIAGNOSTICS rows = ROW_COUNT;
  IF rows <> 1 THEN RAISE EXCEPTION 'FAIL: cannot edit after finish'; END IF;

  -- Discard path: a new session can start now and be cancelled by the host
  PERFORM public.start_workout_session(s2, 'Throwaway', NULL, false);
  UPDATE public.workout_sessions SET status = 'cancelled', ended_at = now() WHERE id = s2 AND host_id = a AND status = 'in_progress';
  GET DIAGNOSTICS rows = ROW_COUNT;
  IF rows <> 1 THEN RAISE EXCEPTION 'FAIL: host cannot discard'; END IF;

  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'ALL_PASSED';
END
$test$;
