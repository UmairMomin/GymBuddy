-- Live buddy session lifecycle + Realtime channel authorization (Milestone 19).
-- Rolled back; expect error text 'ALL_PASSED'.
DO $test$
DECLARE
  a UUID := gen_random_uuid(); b UUID := gen_random_uuid(); c UUID := gen_random_uuid();
  link UUID; ub TEXT; ua TEXT; r UUID; s1 UUID := gen_random_uuid(); s2 UUID := gen_random_uuid();
  n INT; st TEXT; ok BOOLEAN;

BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (a, 'xa_' || left(a::text, 6) || '@gymbuddy.local', '{}'),
    (b, 'xb_' || left(b::text, 6) || '@gymbuddy.local', '{}'),
    (c, 'xc_' || left(c::text, 6) || '@gymbuddy.local', '{}');
  SELECT username INTO ua FROM public.profiles WHERE id = a;
  SELECT username INTO ub FROM public.profiles WHERE id = b;

  -- link A <-> B
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT public.request_buddy(ub) INTO link;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.accept_buddy(link);
  EXECUTE 'RESET ROLE';

  -- A: starter plan, start Push WITH buddy
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.seed_starter_plan();
  SELECT id INTO r FROM public.routines WHERE owner_id = a AND name = 'Push';
  PERFORM public.start_workout_session(s1, 'Push', r, true);
  EXECUTE 'RESET ROLE';

  -- B is invited: sees header + their own participant row; no exercises/sets; invite listed
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SELECT status INTO st FROM public.session_participants WHERE session_id = s1 AND user_id = b;
  IF st IS DISTINCT FROM 'invited' THEN RAISE EXCEPTION 'FAIL: buddy not invited (%)', st; END IF;
  SELECT count(*) INTO n FROM public.session_exercises WHERE session_id = s1;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: invitee sees host exercise list'; END IF;
  -- Realtime channel: invitee must NOT be allowed to use the session topic
  PERFORM set_config('realtime.topic', 'session:' || s1::text, true);
  BEGIN
    INSERT INTO realtime.messages (topic, extension, payload, event, private)
      VALUES ('session:' || s1::text, 'broadcast', '{"x":1}'::jsonb, 'rest', true);
    RAISE EXCEPTION 'FAIL: invitee can write to the session channel';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  -- Join (explicit confirmation): copies host's list as their own
  PERFORM public.join_workout_session(s1);
  SELECT count(*) INTO n FROM public.session_exercises WHERE session_id = s1 AND user_id = b;
  IF n <> 6 THEN RAISE EXCEPTION 'FAIL: joiner got % exercises, expected 6', n; END IF;
  -- Now a member: channel write is allowed
  BEGIN
    INSERT INTO realtime.messages (topic, extension, payload, event, private)
      VALUES ('session:' || s1::text, 'broadcast', '{"x":1}'::jsonb, 'rest', true);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FAIL: joined member cannot write to the session channel (%)', SQLERRM;
  END;
  EXECUTE 'RESET ROLE';

  -- C (stranger): cannot use the channel, cannot join
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  PERFORM set_config('realtime.topic', 'session:' || s1::text, true);
  BEGIN
    INSERT INTO realtime.messages (topic, extension, payload, event, private)
      VALUES ('session:' || s1::text, 'broadcast', '{"x":1}'::jsonb, 'rest', true);
    RAISE EXCEPTION 'FAIL: stranger can write to the session channel';
  EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.join_workout_session(s1);
    RAISE EXCEPTION 'FAIL: stranger joined a session';
  EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  EXECUTE 'RESET ROLE';

  -- B finishes their own part: session stays live for the host
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.finish_my_workout(s1);
  SELECT count(*) INTO n FROM public.session_participants WHERE session_id = s1 AND user_id = b AND completed_at IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: buddy completion not recorded'; END IF;
  SELECT status INTO st FROM public.workout_sessions WHERE id = s1;
  IF st <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: buddy finishing ended the whole session'; END IF;
  EXECUTE 'RESET ROLE';

  -- Host finishes: both completed
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.finish_workout_session(s1);
  SELECT count(*) INTO n FROM public.session_participants WHERE session_id = s1 AND completed_at IS NOT NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: expected both completed, got %', n; END IF;

  -- Solo start, then invite the buddy afterwards; decline path; rejoin after decline needs a new invite
  PERFORM public.start_workout_session(s2, 'Pull', NULL, false);
  SELECT count(*) INTO n FROM public.session_participants WHERE session_id = s2;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: solo start created % participants', n; END IF;
  PERFORM public.invite_buddy_to_session(s2);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.decline_workout_session(s2);
  SELECT status INTO st FROM public.session_participants WHERE session_id = s2 AND user_id = b;
  IF st <> 'declined' THEN RAISE EXCEPTION 'FAIL: decline not recorded (%)', st; END IF;
  SELECT count(*) INTO n FROM public.workout_sessions WHERE id = s2;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: declined buddy still sees the session'; END IF;
  BEGIN
    PERFORM public.join_workout_session(s2);
    RAISE EXCEPTION 'FAIL: joined after declining without a new invite';
  EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.invite_buddy_to_session(s2); -- re-invite after decline
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.join_workout_session(s2);
  SELECT status INTO st FROM public.session_participants WHERE session_id = s2 AND user_id = b;
  IF st <> 'joined' THEN RAISE EXCEPTION 'FAIL: re-invited buddy could not join (%)', st; END IF;
  PERFORM public.leave_workout_session(s2);
  SELECT status INTO st FROM public.session_participants WHERE session_id = s2 AND user_id = b;
  IF st <> 'left' THEN RAISE EXCEPTION 'FAIL: leave not recorded (%)', st; END IF;
  EXECUTE 'RESET ROLE';

  -- Account deletion: deleting B must not be blocked and must keep A's set
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  INSERT INTO public.workout_sets (id, session_id, user_id, exercise_id, set_order, weight_kg, reps)
    SELECT gen_random_uuid(), s1, a, exercise_id, 1, 50, 5 FROM public.session_exercises WHERE session_id = s1 AND user_id = a LIMIT 1;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  UPDATE public.workout_sets SET reps = 6 WHERE session_id = s1 AND user_id = a AND weight_kg = 50; -- no-op under RLS: sets are personal
  EXECUTE 'RESET ROLE';
  DELETE FROM auth.users WHERE id = b;
  SELECT count(*) INTO n FROM public.workout_sets WHERE session_id = s1 AND user_id = a AND weight_kg = 50 AND last_edited_by IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: set not kept / editor not cleared after editor deleted (%)', n; END IF;

  RAISE EXCEPTION 'ALL_PASSED';
END
$test$;
