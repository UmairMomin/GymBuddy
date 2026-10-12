-- ==============================================================================
-- ENABLE SUPABASE REALTIME FOR LIVE SESSIONS & WORKOUT SETS
-- Migration: 20261012000004_enable_realtime.sql
-- ==============================================================================

-- Enable REPLICA IDENTITY FULL for complete real-time payload diffs
ALTER TABLE public.workout_sets REPLICA IDENTITY FULL;
ALTER TABLE public.workout_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.session_participants REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_sets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
