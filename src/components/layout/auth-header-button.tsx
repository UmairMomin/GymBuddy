import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/features/auth/actions";
import { LogOut, User } from "lucide-react";
import Link from "next/link";

export async function AuthHeaderButton() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded bg-emerald-500 px-3 py-1.5 font-medium text-zinc-950 hover:bg-emerald-400 transition-colors"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="flex items-center gap-1 text-zinc-300 font-medium">
        <User className="h-3.5 w-3.5 text-emerald-400" />
        <span>{user.email?.split("@")[0]}</span>
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          aria-label="Sign out"
          className="text-zinc-400 hover:text-red-400 p-1"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
