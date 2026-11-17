import { Suspense } from "react";
import { PageLoader } from "@/components/ui/loaders";
import { connection } from "next/server";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getBuddyOverviewAction } from "@/features/buddy/actions";
import { BuddyView } from "@/features/buddy/components/buddy-view";

async function BuddyContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
        <Lock className="mb-3 h-10 w-10 text-zinc-600" />
        <h2 className="text-xl font-bold">Sign In Required</h2>
        <p className="mb-4 mt-1 max-w-sm text-sm text-zinc-400">Sign in to link up with your training buddy.</p>
        <Link href="/login">
          <Button>Sign In to Continue</Button>
        </Link>
      </div>
    );
  }

  const res = await getBuddyOverviewAction();
  if (!res.data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-400">
        <p>{res.error ?? "Unable to load your buddy"}</p>
      </div>
    );
  }
  return <BuddyView overview={res.data} />;
}

export default function BuddyPage() {
  return (
    <Suspense
      fallback={<PageLoader label="Loading your buddy…" />}
    >
      <BuddyContent />
    </Suspense>
  );
}
