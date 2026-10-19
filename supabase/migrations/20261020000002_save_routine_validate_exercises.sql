-- save_routine: reject exercise ids the caller cannot see (another user's custom exercise).
-- Same body as 20261020000000 plus the validation block.
CREATE OR REPLACE FUNCTION public.save_routine(
  p_routine_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_structure JSONB,
  p_weekdays SMALLINT[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_owner UUID;
  v_next INT;
  v_day SMALLINT;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_typeof(p_structure) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'structure must be a JSON array';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_structure) AS e(exercise_id UUID)
      LEFT JOIN public.exercises x
        ON x.id = e.exercise_id AND (x.owner_id IS NULL OR x.owner_id = v_me)
     WHERE x.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Routine contains an unknown exercise';
  END IF;

  SELECT owner_id INTO v_owner FROM public.routines WHERE id = p_routine_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.routines (id, owner_id, name, description)
    VALUES (p_routine_id, v_me, p_name, NULLIF(p_description, ''));
  ELSIF v_owner <> v_me THEN
    RAISE EXCEPTION 'Not your routine';
  ELSE
    UPDATE public.routines SET name = p_name, description = NULLIF(p_description, '')
     WHERE id = p_routine_id;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
    FROM public.routine_versions WHERE routine_id = p_routine_id;
  INSERT INTO public.routine_versions (routine_id, version_number, structure_json)
  VALUES (p_routine_id, v_next, p_structure);

  DELETE FROM public.weekly_schedule
   WHERE user_id = v_me AND routine_id = p_routine_id
     AND NOT (weekday = ANY (COALESCE(p_weekdays, ARRAY[]::SMALLINT[])));
  FOREACH v_day IN ARRAY COALESCE(p_weekdays, ARRAY[]::SMALLINT[]) LOOP
    IF v_day NOT BETWEEN 0 AND 6 THEN RAISE EXCEPTION 'Invalid weekday %', v_day; END IF;
    INSERT INTO public.weekly_schedule (user_id, weekday, routine_id)
    VALUES (v_me, v_day, p_routine_id)
    ON CONFLICT (user_id, weekday) DO UPDATE SET routine_id = EXCLUDED.routine_id;
  END LOOP;

  RETURN p_routine_id;
END $$;

REVOKE ALL ON FUNCTION public.save_routine(UUID, TEXT, TEXT, JSONB, SMALLINT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_routine(UUID, TEXT, TEXT, JSONB, SMALLINT[]) TO authenticated;
