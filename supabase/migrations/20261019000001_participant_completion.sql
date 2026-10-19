-- ==============================================================================
-- PARTICIPANT COMPLETION & EXTENSIONS
-- Migration: 20261019000001_participant_completion.sql
-- ==============================================================================

ALTER TABLE public.session_participants
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes TEXT;
