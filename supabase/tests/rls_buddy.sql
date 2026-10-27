-- RLS behaviour test for the V2 solo + buddy model (Milestone 15).
-- Impersonates three users via request.jwt.claims. Everything runs inside one transaction
-- and ends with RAISE EXCEPTION so nothing is persisted: a result of 'ALL_PASSED' means success.
DO $test$
DECLARE
  a UUID := gen_random_uuid(); b UUID := gen_random_uuid(); c UUID := gen_random_uuid();
  r1 UUID := gen_random_uuid(); s_solo UUID := gen_random_uuid(); s_shared UUID := gen_random_uuid();
  set1 UUID := gen_random_uuid(); ex UUID; n INT; rev INT; editor UUID; link UUID; ua TEXT; ub TEXT;

BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (a, 'ta_' || left(a::text, 6) || '@gymbuddy.local', '{}'),
    (b, 'tb_' || left(b::text, 6) || '@gymbuddy.local', '{}'),
    (c, 'tc_' || left(c::text, 6) || '@gymbuddy.local', '{}');
  SELECT id INTO ex FROM public.exercises WHERE owner_id IS NULL LIMIT 1;
  SELECT username INTO ua FROM public.profiles WHERE id = a;
  SELECT username INTO ub FROM public.profiles WHERE id = b;

  -- === as A: link, routine, solo + shared sessions ===
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT public.request_buddy(ub) INTO link;
  EXECUTE 'RESET ROLE';

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.accept_buddy(link);
  EXECUTE 'RESET ROLE';

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.save_routine(r1, 'Push A', NULL,
    jsonb_build_array(jsonb_build_object('exercise_id', ex, 'position', 0, 'target_sets', 3)), ARRAY[0]::smallint[]);
  PERFORM public.start_workout_session(s_solo, 'Solo day', r1, false);
  PERFORM public.finish_workout_session(s_solo);
  PERFORM public.start_workout_session(s_shared, 'Shared day', r1, true);
  INSERT INTO public.workout_sets (id, session_id, user_id, exercise_id, set_order, weight_kg, reps, completed)
    VALUES (set1, s_shared, a, ex, 1, 30, 10, true);
  INSERT INTO public.body_metrics (user_id, weight_kg) VALUES (a, 80);
  EXECUTE 'RESET ROLE';

  -- === as B (invited, not yet joined) ===
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.workout_sessions WHERE id = s_solo;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: buddy sees solo session'; END IF;
  SELECT count(*) INTO n FROM public.workout_sessions WHERE id = s_shared;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: invitee cannot see invited session header'; END IF;
  SELECT count(*) INTO n FROM public.workout_sets WHERE session_id = s_shared;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: invitee sees sets before joining'; END IF;
  SELECT count(*) INTO n FROM public.routines;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: buddy sees A routines'; END IF;
  SELECT count(*) INTO n FROM public.body_metrics;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: buddy sees A body metrics'; END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE id = a;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: buddy cannot read A profile'; END IF;
  PERFORM public.join_workout_session(s_shared);
  SELECT count(*) INTO n FROM public.session_exercises WHERE session_id = s_shared AND user_id = b;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: joiner did not get own exercise list'; END IF;
  SELECT count(*) INTO n FROM public.workout_sets WHERE session_id = s_shared;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: joined buddy cannot see sets'; END IF;
  -- sets are personal: B can neither edit nor delete A's set
  WITH u AS (UPDATE public.workout_sets SET weight_kg = 32.5 WHERE id = set1 RETURNING 1) SELECT count(*) INTO n FROM u;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B edited A set'; END IF;
  WITH d AS (DELETE FROM public.workout_sets WHERE id = set1 RETURNING 1) SELECT count(*) INTO n FROM d;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B deleted A set'; END IF;
  -- B logs own set
  INSERT INTO public.workout_sets (session_id, user_id, exercise_id, set_order, weight_kg, reps)
    VALUES (s_shared, b, ex, 1, 24, 12);
  -- B cannot create a set for a non-member
  BEGIN
    INSERT INTO public.workout_sets (session_id, user_id, exercise_id, set_order) VALUES (s_shared, c, ex, 1);
    RAISE EXCEPTION 'FAIL: set created for non-member';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; WHEN others THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- === A finishes, then can still edit their own set ===
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.finish_workout_session(s_shared);
  UPDATE public.workout_sets SET reps = 11 WHERE id = set1;
  SELECT revision_number INTO rev FROM public.workout_sets WHERE id = set1;
  IF rev <> 2 THEN RAISE EXCEPTION 'FAIL: own edit after finish rejected (rev %)', rev; END IF;
  EXECUTE 'RESET ROLE';

  -- === as C (stranger) sees nothing ===
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.workout_sessions;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: stranger sees sessions'; END IF;
  SELECT count(*) INTO n FROM public.workout_sets;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: stranger sees sets'; END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE id <> c;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: stranger sees other profiles'; END IF;
  SELECT count(*) INTO n FROM public.buddy_links;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: stranger sees buddy links'; END IF;
  -- one buddy max: C cannot request A (A already has one)
  BEGIN
    PERFORM public.request_buddy(ua);
    RAISE EXCEPTION 'FAIL: second buddy allowed';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'ALL_PASSED';
END
$test$;
