-- ==============================================================================
-- FIX: RECURSIVE RLS POLICIES ON WORKSPACE_MEMBERS
-- Migration: 20261012000002_fix_workspace_members_rls.sql
-- ==============================================================================

-- 1. Helper function with SECURITY DEFINER to check admin/owner role safely without recursion
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Ensure is_workspace_member also runs with safe search_path
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- 2. Drop recursive policies
DROP POLICY IF EXISTS "Members can view other members in the same workspace" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins or owners can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view their own memberships or shared workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users or admins can insert memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins or owners can update memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON public.workspace_members;

-- 3. Non-recursive SELECT policy:
CREATE POLICY "Users can view their own memberships or shared workspace members"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- 4. INSERT policy:
CREATE POLICY "Users or admins can insert memberships"
  ON public.workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid())
  );

-- 5. UPDATE policy:
CREATE POLICY "Admins or owners can update memberships"
  ON public.workspace_members FOR UPDATE
  TO authenticated
  USING (
    public.is_workspace_admin(workspace_id, auth.uid())
  );

-- 6. DELETE policy:
CREATE POLICY "Users can leave or admins can remove members"
  ON public.workspace_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid())
  );
