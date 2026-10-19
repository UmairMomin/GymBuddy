-- Web Push subscription functions (Milestone 21). Rolled back; expect error text 'ALL_PASSED'.
DO $test$
DECLARE
  a UUID := gen_random_uuid(); b UUID := gen_random_uuid(); c UUID := gen_random_uuid();
  link UUID; ub TEXT; s1 UUID := gen_random_uuid(); n INT;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (a, 'pa_' || left(a::text, 6) || '@gymbuddy.local', '{}'),
    (b, 'pb_' || left(b::text, 6) || '@gymbuddy.local', '{}'),
    (c, 'pc_' || left(c::text, 6) || '@gymbuddy.local', '{}');
  SELECT username INTO ub FROM public.profiles WHERE id = b;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT public.request_buddy(ub) INTO link;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.accept_buddy(link);
  -- B registers a device; non-https endpoint rejected
  PERFORM public.save_push_subscription('https://push.example/b1', 'p256', 'authkey');
  BEGIN
    PERFORM public.save_push_subscription('http://insecure/b', 'p', 'a');
    RAISE EXCEPTION 'FAIL: insecure endpoint accepted';
  EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  EXECUTE 'RESET ROLE';

  -- C registers a device too (a stranger)
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  PERFORM public.save_push_subscription('https://push.example/c1', 'p256', 'authkey');
  -- raw table is private: C sees only their own
  SELECT count(*) INTO n FROM public.push_subscriptions;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: push_subscriptions visible across users (%)', n; END IF;
  EXECUTE 'RESET ROLE';

  -- A hosts a session and invites B: A can fetch ONLY B's endpoint
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.start_workout_session(s1, 'Push', NULL, true);
  SELECT count(*) INTO n FROM public.invited_push_targets(s1);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: expected 1 push target, got %', n; END IF;
  IF (SELECT endpoint FROM public.invited_push_targets(s1)) <> 'https://push.example/b1' THEN
    RAISE EXCEPTION 'FAIL: wrong push target';
  END IF;
  -- A cannot prune a stranger's endpoint
  PERFORM public.prune_push_subscription(s1, 'https://push.example/c1');
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.push_subscriptions WHERE endpoint = 'https://push.example/c1';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: host pruned a stranger endpoint'; END IF;
  -- A can prune the invitee's dead endpoint
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.prune_push_subscription(s1, 'https://push.example/b1');
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.push_subscriptions WHERE endpoint = 'https://push.example/b1';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: dead endpoint not pruned'; END IF;

  -- B re-registers; C (a stranger) cannot fetch targets for A's session
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.save_push_subscription('https://push.example/b2', 'p256', 'authkey');
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.invited_push_targets(s1);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: stranger can fetch push targets'; END IF;
  EXECUTE 'RESET ROLE';

  -- Once B answers (declines), they are no longer a target
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.decline_workout_session(s1);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.invited_push_targets(s1);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: declined buddy still a push target'; END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'ALL_PASSED';
END
$test$;
