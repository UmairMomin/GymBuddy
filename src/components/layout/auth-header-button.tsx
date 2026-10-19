"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/features/auth/actions";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function AuthHeaderButton() {
  const [user, setUser] = React.useState<SupabaseUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="h-7 w-16 animate-pulse rounded bg-zinc-800" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded bg-emerald-500 px-3 py-1.5 font-medium text-accent-ink hover:bg-emerald-400 transition-colors"
      >
        Sign In
      </Link>
    );
  }

  const username =
    user.user_metadata?.display_name || user.email?.split("@")[0] || "User";

  return (
    <div className="flex items-center space-x-2">
      <span className="flex items-center gap-1 text-zinc-300 font-medium">
        <User className="h-3.5 w-3.5 text-emerald-400" />
        <span className="capitalize">{username}</span>
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
