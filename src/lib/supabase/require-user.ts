import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Defense in depth for server actions: they are public POST endpoints, so each mutation
 * re-verifies the session itself instead of relying only on the proxy and RLS.
 */
export async function requireUser(
  supabase: SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export const SIGN_IN_REQUIRED = "You must be signed in to do that";
