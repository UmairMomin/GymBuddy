-- Universal exercise library: one shared list for everyone. Anyone can add or edit; an exercise that
-- history depends on is archived (hidden from pickers) instead of deleted. owner_id now only records
-- who added it (NULL = built-in).

-- 1. Merge same-name exercises (case-insensitive) into one. Built-ins win, then the oldest.
CREATE TEMP TABLE ex_merge ON COMMIT DROP AS
WITH ranked AS (
  SELECT id, lower(name) AS k,
         row_number() OVER (PARTITION BY lower(name) ORDER BY (owner_id IS NULL) DESC, created_at, id) AS rn
    FROM public.exercises
)
SELECT r.id AS loser, w.id AS winner
  FROM ranked r JOIN ranked w ON w.k = r.k AND w.rn = 1
 WHERE r.rn > 1;

-- Repointing history must not look like a user edit (revision bump / editor stamp).
ALTER TABLE public.workout_sets DISABLE TRIGGER workout_sets_stamp_trg;
UPDATE public.workout_sets s SET exercise_id = m.winner FROM ex_merge m WHERE s.exercise_id = m.loser;
ALTER TABLE public.workout_sets ENABLE TRIGGER workout_sets_stamp_trg;
UPDATE public.session_exercises s SET exercise_id = m.winner FROM ex_merge m WHERE s.exercise_id = m.loser;

-- Routine versions keep exercise ids inside structure_json.
UPDATE public.routine_versions rv SET structure_json = (
  SELECT jsonb_agg(
           CASE WHEN m.winner IS NULL THEN t.el ELSE jsonb_set(t.el, '{exercise_id}', to_jsonb(m.winner::text)) END
           ORDER BY t.ord)
    FROM jsonb_array_elements(rv.structure_json) WITH ORDINALITY AS t(el, ord)
    LEFT JOIN ex_merge m ON m.loser::text = t.el->>'exercise_id'
)
WHERE jsonb_typeof(rv.structure_json) = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(rv.structure_json) AS e(el)
               JOIN ex_merge m ON m.loser::text = e.el->>'exercise_id');

DELETE FROM public.exercises e USING ex_merge m WHERE e.id = m.loser;

-- 2. One name, one exercise.
DROP INDEX IF EXISTS public.exercises_system_name_uniq;
DROP INDEX IF EXISTS public.exercises_owner_name_uniq;
CREATE UNIQUE INDEX exercises_name_uniq ON public.exercises (lower(name));
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 3. Everyone reads, adds and edits. Deleting goes through delete_or_archive_exercise().
DROP POLICY IF EXISTS "Exercises: read system and own" ON public.exercises;
DROP POLICY IF EXISTS "Exercises: insert own" ON public.exercises;
DROP POLICY IF EXISTS "Exercises: update own" ON public.exercises;
DROP POLICY IF EXISTS "Exercises: delete own" ON public.exercises;
CREATE POLICY "Exercises: read all" ON public.exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Exercises: insert" ON public.exercises
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Exercises: update" ON public.exercises
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Delete when nothing refers to it, otherwise archive. Returns 'deleted' or 'archived'.
CREATE OR REPLACE FUNCTION public.delete_or_archive_exercise(p_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exercises WHERE id = p_id) THEN RAISE EXCEPTION 'Unknown exercise'; END IF;
  IF EXISTS (SELECT 1 FROM public.workout_sets WHERE exercise_id = p_id)
     OR EXISTS (SELECT 1 FROM public.session_exercises WHERE exercise_id = p_id)
     OR EXISTS (SELECT 1 FROM public.routine_versions WHERE structure_json::text LIKE '%' || p_id::text || '%') THEN
    UPDATE public.exercises SET archived_at = COALESCE(archived_at, now()) WHERE id = p_id;
    RETURN 'archived';
  END IF;
  DELETE FROM public.exercises WHERE id = p_id;
  RETURN 'deleted';
END $$;
REVOKE ALL ON FUNCTION public.delete_or_archive_exercise(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_or_archive_exercise(UUID) TO authenticated;

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
        ON x.id = e.exercise_id AND x.archived_at IS NULL
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

-- A deleted account must not take shared exercises (and others' history) with it.
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_owner_id_fkey;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
