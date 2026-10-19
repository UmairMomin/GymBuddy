-- ==============================================================================
-- Milestone 17: routine archiving + starter plan
-- * Routines are archived, never hard-deleted, so session snapshots keep their
--   routine_version_id (history stays intact).
-- * seed_starter_plan(): one transaction that creates Push / Pull / Legs /
--   Shoulders + Arms and assigns the Push-Pull-Legs-Push-Pull-S+A week (Sun rest).
-- ==============================================================================

ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS routines_owner_active_idx ON public.routines (owner_id) WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.archive_routine(p_routine_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.routines SET archived_at = now()
   WHERE id = p_routine_id AND owner_id = auth.uid() AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Routine not found'; END IF;
  UPDATE public.weekly_schedule SET routine_id = NULL
   WHERE user_id = auth.uid() AND routine_id = p_routine_id;
END $$;

-- Starter week. Item tuple: [exercise name, sets, rep_min, rep_max, rest_seconds].
CREATE OR REPLACE FUNCTION public.seed_starter_plan()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_defs JSONB := '[
    {"name":"Push","days":[0,3],"items":[
      ["Barbell Bench Press",4,6,8,120],["Incline Dumbbell Press",4,8,10,90],
      ["Seated Dumbbell Shoulder Press",3,8,10,90],["Dumbbell Lateral Raise",3,12,15,60],
      ["Tricep Rope Pushdown",3,10,12,60],["Overhead Tricep Extension",3,10,12,60]]},
    {"name":"Pull","days":[1,4],"items":[
      ["Pull-Up",4,6,10,120],["Barbell Bent-Over Row",4,8,10,90],["Seated Cable Row",3,10,12,90],
      ["Lat Pulldown",3,10,12,90],["Face Pull",3,12,15,60],["Hammer Curl",3,10,12,60]]},
    {"name":"Legs","days":[2],"items":[
      ["Barbell Back Squat",4,6,8,150],["Romanian Deadlift",3,8,10,120],["Leg Press",3,10,12,90],
      ["Leg Extension",3,12,15,60],["Lying Leg Curl",3,12,15,60],["Standing Calf Raise",4,12,15,60]]},
    {"name":"Shoulders + Arms","days":[5],"items":[
      ["Standing Overhead Press",4,6,8,120],["Dumbbell Lateral Raise",4,12,15,60],["Rear Delt Fly",3,12,15,60],
      ["Barbell Bicep Curl",3,8,10,60],["Incline Dumbbell Curl",3,10,12,60],
      ["Skull Crusher",3,8,10,60],["Tricep Rope Pushdown",3,10,12,60]]}
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
             'rep_max', (i.item->>3)::int,
             'rest_seconds', (i.item->>4)::int) ORDER BY i.ord)
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

REVOKE ALL ON FUNCTION public.archive_routine(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_starter_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_routine(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_starter_plan() TO authenticated;
