import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileMenu } from "@/components/layout/profile-menu";

/**
 * Server-rendered so the header reflects the real session on every render. After sign-in/out the
 * client calls router.refresh(), which re-renders this and updates the header with no page reload.
 */
export async function UserMenu() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <ProfileMenu user={null} />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const username = user.email?.split("@")[0] ?? "user";
  const name =
    profile?.display_name?.trim() ||
    (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "") ||
    username;

  return <ProfileMenu user={{ name, username }} />;
}
