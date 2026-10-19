-- ==============================================================================
-- Milestone 21: Web Push plumbing (no service-role key on the server)
-- push_subscriptions rows are private to their owner, so the host cannot read the
-- invited buddy's subscription directly. These SECURITY DEFINER functions expose
-- exactly what is needed, and nothing else:
--   save_push_subscription   - the signed-in user registers a device (re-homes an endpoint
--                              that was previously registered by another account on that device)
--   invited_push_targets     - for a live session I host, the subscriptions of invitees who
--                              have not answered yet
--   prune_push_subscription  - drop a dead endpoint (HTTP 404/410 from the push service), only
--                              if it belongs to one of those invitees
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_endpoint !~ '^https://' OR char_length(p_endpoint) > 2048 THEN
    RAISE EXCEPTION 'Invalid push endpoint';
  END IF;
  -- One browser profile = one endpoint = one account at a time.
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint AND user_id <> auth.uid();
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;
END $$;

CREATE OR REPLACE FUNCTION public.invited_push_targets(p_session_id UUID)
RETURNS TABLE (endpoint TEXT, p256dh TEXT, auth TEXT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT ps.endpoint, ps.p256dh, ps.auth
    FROM public.push_subscriptions ps
    JOIN public.session_participants sp ON sp.user_id = ps.user_id
    JOIN public.workout_sessions s ON s.id = sp.session_id
   WHERE sp.session_id = p_session_id
     AND sp.status = 'invited'
     AND s.host_id = auth.uid()
     AND s.status = 'in_progress';
$$;

CREATE OR REPLACE FUNCTION public.prune_push_subscription(p_session_id UUID, p_endpoint TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.push_subscriptions ps
   WHERE ps.endpoint = p_endpoint
     AND EXISTS (SELECT 1 FROM public.invited_push_targets(p_session_id) t WHERE t.endpoint = p_endpoint);
$$;

REVOKE ALL ON FUNCTION public.save_push_subscription(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invited_push_targets(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prune_push_subscription(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invited_push_targets(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prune_push_subscription(UUID, TEXT) TO authenticated;
