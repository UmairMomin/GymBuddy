-- Anyone in a session (host or guest) finishes their own part; the session completes when the last
-- joined person has finished. Replaces the host-only "end it for everyone" behaviour.
CREATE OR REPLACE FUNCTION public.finish_my_workout(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.session_participants SET completed_at = COALESCE(completed_at, now())
   WHERE session_id = p_session_id AND user_id = auth.uid() AND status = 'joined';
  IF NOT FOUND THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.session_participants
     WHERE session_id = p_session_id AND status = 'joined' AND completed_at IS NULL
  ) THEN
    UPDATE public.workout_sessions SET status = 'completed', ended_at = now()
     WHERE id = p_session_id AND status = 'in_progress';
    UPDATE public.session_participants SET status = 'declined'
     WHERE session_id = p_session_id AND status = 'invited';
  END IF;
END $$;

-- "Finish for both": any joined participant can end the session for everyone.
CREATE OR REPLACE FUNCTION public.finish_workout_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_participants
                  WHERE session_id = p_session_id AND user_id = auth.uid() AND status = 'joined') THEN
    RAISE EXCEPTION 'Only someone in this workout can finish it';
  END IF;
  UPDATE public.workout_sessions SET status = 'completed', ended_at = now()
   WHERE id = p_session_id AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'This workout is already over'; END IF;
  UPDATE public.session_participants SET completed_at = COALESCE(completed_at, now())
   WHERE session_id = p_session_id AND status = 'joined';
  UPDATE public.session_participants SET status = 'declined'
   WHERE session_id = p_session_id AND status = 'invited';
END $$;
