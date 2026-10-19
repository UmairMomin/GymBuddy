import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getPlanDataAction } from "@/features/plan/actions";
import { PlanView, type PlanTab } from "@/features/plan/components/plan-view";

const TABS: PlanTab[] = ["schedule", "routines", "exercises"];

async function PlanContent({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection();
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
        <Lock className="mb-3 h-10 w-10 text-zinc-600" />
        <h2 className="text-xl font-bold">Sign In Required</h2>
        <p className="mb-4 mt-1 max-w-sm text-sm text-zinc-400">Sign in to plan your training week.</p>
        <Link href="/login">
          <Button>Sign In to Continue</Button>
        </Link>
      </div>
    );
  }

  const res = await getPlanDataAction();
  if (!res.data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-400">
        <p>{res.error ?? "Unable to load your plan"}</p>
      </div>
    );
  }

  const initialTab = TABS.find((t) => t === tab) ?? "schedule";
  return <PlanView data={res.data} initialTab={initialTab} />;
}

export default function PlanPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs text-zinc-500">Loading your plan...</p>
        </div>
      }
    >
      <PlanContent searchParams={searchParams} />
    </Suspense>
  );
}
