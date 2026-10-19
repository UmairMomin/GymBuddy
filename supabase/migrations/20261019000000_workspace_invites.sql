-- ==============================================================================
-- WORKSPACE INVITES & JOIN FUNCTIONALITY
-- Migration: 20261019000000_workspace_invites.sql
-- ==============================================================================

-- 1. Add invite_code column to workspaces
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- 2. Populate existing workspaces with an invite code if null
UPDATE public.workspaces
SET invite_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8))
WHERE invite_code IS NULL;

-- 3. Set default for new rows
ALTER TABLE public.workspaces
ALTER COLUMN invite_code SET DEFAULT UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));

-- 4. Stored procedure to join a workspace by invite code safely
CREATE OR REPLACE FUNCTION public.join_workspace_by_invite_code(_invite_code TEXT)
RETURNS jsonb AS $$
DECLARE
  _ws RECORD;
  _user_id UUID := auth.uid();
  _existing RECORD;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Must be authenticated to join a group');
  END IF;

  IF _invite_code IS NULL OR TRIM(_invite_code) = '' THEN
    RETURN jsonb_build_object('error', 'Invite code is required');
  END IF;

  SELECT * INTO _ws
  FROM public.workspaces
  WHERE UPPER(invite_code) = UPPER(TRIM(_invite_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid invite code. Group not found.');
  END IF;

  SELECT * INTO _existing
  FROM public.workspace_members
  WHERE workspace_id = _ws.id AND user_id = _user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'workspace_id', _ws.id,
      'workspace_name', _ws.name,
      'already_member', true
    );
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_ws.id, _user_id, 'member');

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', _ws.id,
    'workspace_name', _ws.name,
    'already_member', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
