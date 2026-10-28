-- Rename a freestyle workout (one started without a routine). Host or buddy may rename it; routine
-- sessions keep the routine's name. An RPC rather than a looser RLS policy: the buddy gets to change
-- the name column only, never anything else on the session row.
CREATE OR REPLACE FUNCTION public.rename_session(p_session_id UUID, p_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT := btrim(p_name);
BEGIN
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Name must be 1 to 80 characters';
  END IF;
  IF NOT public.is_session_member(p_session_id) THEN
    RAISE EXCEPTION 'Only someone in this workout can rename it';
  END IF;
  UPDATE public.workout_sessions SET name = v_name
   WHERE id = p_session_id AND routine_id IS NULL AND status <> 'cancelled';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only freestyle workouts can be renamed'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.rename_session(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_session(UUID, TEXT) TO authenticated;
