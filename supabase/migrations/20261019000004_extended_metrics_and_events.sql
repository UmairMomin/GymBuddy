-- ==============================================================================
-- BODY METRICS & SESSION EVENTS AUDIT SCHEMA
-- Migration: 20261019000004_extended_metrics_and_events.sql
-- ==============================================================================

-- 1. BODY METRICS TABLE (Strictly private personal progress tracking)
CREATE TABLE IF NOT EXISTS public.body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2) NOT NULL,
  body_fat_percentage NUMERIC(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own body metrics"
  ON public.body_metrics FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. SESSION EVENTS TABLE (Audit trail of collaborative live session actions)
CREATE TABLE IF NOT EXISTS public.session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session members can view session events"
  ON public.session_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = session_id
        AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Session members can insert session events"
  ON public.session_events FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = session_id
        AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

-- Enable Realtime publication for session_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_events;
ALTER TABLE public.session_events REPLICA IDENTITY FULL;
