-- Starter plan + routine archiving (Milestone 17). Rolled back; expect error text 'ALL_PASSED'.
DO $test$
DECLARE
  a UUID := gen_random_uuid(); n INT; r UUID; lens INT[];
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (a, 'tp_' || left(a::text, 6) || '@gymbuddy.local', '{}');
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  PERFORM public.seed_starter_plan();

  SELECT count(*) INTO n FROM public.routines WHERE owner_id = a;
  IF n <> 4 THEN RAISE EXCEPTION 'FAIL: expected 4 routines, got %', n; END IF;

  SELECT array_agg(jsonb_array_length(v.structure_json) ORDER BY r.name) INTO lens
    FROM public.routines r JOIN public.routine_versions v ON v.routine_id = r.id;
  -- Legs 6, Pull 6, Push 6, Shoulders + Arms 7 (any name that failed to resolve would shrink a list)
  IF lens <> ARRAY[6, 6, 6, 7] THEN RAISE EXCEPTION 'FAIL: exercise names did not all resolve: %', lens; END IF;

  SELECT count(*) INTO n FROM public.weekly_schedule WHERE user_id = a;
  IF n <> 7 THEN RAISE EXCEPTION 'FAIL: expected 7 schedule rows, got %', n; END IF;
  SELECT count(*) INTO n FROM public.weekly_schedule WHERE user_id = a AND routine_id IS NULL AND weekday = 6;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Sunday should be rest'; END IF;
  SELECT count(*) INTO n FROM public.weekly_schedule s JOIN public.routines r ON r.id = s.routine_id
    WHERE s.user_id = a AND r.name = 'Push' AND s.weekday IN (0, 3);
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: Push should run Mon + Thu'; END IF;

  -- Seeding twice is refused
  BEGIN
    PERFORM public.seed_starter_plan();
    RAISE EXCEPTION 'FAIL: seeded twice';
  EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;

  -- Archive clears the schedule but keeps the routine row + versions
  SELECT id INTO r FROM public.routines WHERE owner_id = a AND name = 'Legs';
  PERFORM public.archive_routine(r);
  SELECT count(*) INTO n FROM public.weekly_schedule WHERE routine_id = r;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: archived routine still scheduled'; END IF;
  SELECT count(*) INTO n FROM public.routine_versions WHERE routine_id = r;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: archive removed versions'; END IF;

  -- Editing creates version 2 and moves days
  PERFORM public.save_routine(
    (SELECT id FROM public.routines WHERE owner_id = a AND name = 'Push'), 'Push', NULL, '[]'::jsonb, ARRAY[0]::smallint[]);
  SELECT count(*) INTO n FROM public.weekly_schedule s JOIN public.routines r ON r.id = s.routine_id
    WHERE s.user_id = a AND r.name = 'Push';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Push days not reduced to Mon only (%)', n; END IF;
  SELECT max(version_number) INTO n FROM public.routine_versions v JOIN public.routines r ON r.id = v.routine_id
    WHERE r.name = 'Push' AND r.owner_id = a;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: expected push version 2, got %', n; END IF;

  -- Unknown / invisible exercise ids are rejected
  BEGIN
    PERFORM public.save_routine(gen_random_uuid(), 'Bad', NULL,
      jsonb_build_array(jsonb_build_object('exercise_id', gen_random_uuid(), 'position', 0)), ARRAY[]::smallint[]);
    RAISE EXCEPTION 'FAIL: unknown exercise accepted';
  EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;

  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'ALL_PASSED';
END
$test$;
