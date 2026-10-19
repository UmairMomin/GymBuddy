-- ==============================================================================
-- RESTRICT PROFILES VISIBILITY
-- Migration: 20261019000006_restrict_profiles_select.sql
--
-- Before: any authenticated user could SELECT every row in public.profiles, which
-- exposes every account's display name and internal login email
-- (<username>@gymbuddy.local) to every other signed-in user.
--
-- After: a user can read their own profile plus the profiles of people who share at
-- least one workspace with them (needed for the member list, shared sessions and set
-- attribution). Writes are unchanged ("Users can update their own profile").
--
-- Side effect to be aware of: once someone leaves/is removed from every workspace you
-- share, their name is no longer readable by you, so their historical sets in shared
-- sessions fall back to the generic "Trainee" label in the UI.
--
-- Rollback:
--   DROP POLICY "Profiles viewable by self and workspace peers" ON public.profiles;
--   CREATE POLICY "Public profiles are viewable by authenticated users"
--     ON public.profiles FOR SELECT TO authenticated USING (true);
-- ==============================================================================

-- SECURITY DEFINER avoids RLS recursion through workspace_members, same pattern as
-- is_workspace_member / is_workspace_admin.
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_other_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them ON them.workspace_id = me.workspace_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = _other_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

REVOKE ALL ON FUNCTION public.shares_workspace_with(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_workspace_with(UUID) TO authenticated;

DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by self and workspace peers" ON public.profiles;

CREATE POLICY "Profiles viewable by self and workspace peers"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR public.shares_workspace_with(id)
  );
