-- ==============================================================================
-- USER PREFERRED UNIT PREFERENCE
-- Migration: 20261019000002_user_preferred_unit.sql
-- ==============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_unit TEXT NOT NULL DEFAULT 'kg' CHECK (preferred_unit IN ('kg', 'lb'));
