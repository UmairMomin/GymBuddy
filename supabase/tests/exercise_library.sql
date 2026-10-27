-- Universal exercise library. Rolled back; expect error text 'ALL_PASSED'.
DO $test$
DECLARE
  a UUID := gen_random_uuid(); b UUID := gen_random_uuid(); ex UUID; n INT; res TEXT;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (a, 'ex_' || left(a::text, 6) || '@gymbuddy.local', '{}');
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (b, 'ex_' || left(b::text, 6) || '@gymbuddy.local', '{}');

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  INSERT INTO public.exercises (owner_id, name, category) VALUES (a, 'Zz Shared Fly', 'chest') RETURNING id INTO ex;

  -- B sees A's exercise, may edit it, and cannot create a same-name twin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.exercises WHERE id = ex;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: B cannot see A exercise'; END IF;
  UPDATE public.exercises SET notes = 'edited by B' WHERE id = ex;
  SELECT count(*) INTO n FROM public.exercises WHERE id = ex AND notes = 'edited by B';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: B cannot edit A exercise'; END IF;
  BEGIN
    INSERT INTO public.exercises (owner_id, name, category) VALUES (b, 'zz shared fly', 'chest');
    RAISE EXCEPTION 'FAIL: duplicate name allowed';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- Unused exercise is deleted; one with history is archived
  SELECT public.delete_or_archive_exercise(ex) INTO res;
  IF res <> 'deleted' THEN RAISE EXCEPTION 'FAIL: unused exercise not deleted (%)', res; END IF;
  SELECT id INTO ex FROM public.exercises WHERE owner_id IS NULL LIMIT 1;
  PERFORM public.start_workout_session(gen_random_uuid(), 'Solo', NULL, false);
  INSERT INTO public.session_exercises (session_id, user_id, exercise_id, position)
    SELECT id, b, ex, 0 FROM public.workout_sessions WHERE host_id = b LIMIT 1;
  SELECT public.delete_or_archive_exercise(ex) INTO res;
  IF res <> 'archived' THEN RAISE EXCEPTION 'FAIL: used exercise not archived (%)', res; END IF;

  RAISE EXCEPTION 'ALL_PASSED';
END
$test$;
