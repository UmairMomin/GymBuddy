import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceDetailsAction } from "@/features/groups/actions";
import { GroupView } from "@/features/groups/components/group-view";
import { Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

async function GroupContent({
  workspaceId,
  autoJoinCode,
}: {
  workspaceId?: string;
  autoJoinCode?: string;
}) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-4">
        <Lock className="h-10 w-10 text-zinc-600 mb-3" />
        <h2 className="text-xl font-bold">Sign In Required</h2>
        <p className="text-sm text-zinc-400 mt-1 max-w-sm mb-4">
          Please sign in to manage your training group and invite gym partners.
        </p>
        <Link href="/login">
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold">
            Sign In to Continue
          </Button>
        </Link>
      </div>
    );
  }

  const res = await getWorkspaceDetailsAction(workspaceId);

  if (res.error || !res.data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-400">
        <p>{res.error || "Unable to load training group details"}</p>
      </div>
    );
  }

  return (
    <GroupView
      details={res.data}
      currentUserId={user.id}
      autoJoinCode={autoJoinCode}
    />
  );
}

async function GroupContentWrapper({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; join?: string }>;
}) {
  const { workspaceId, join } = await searchParams;
  return <GroupContent workspaceId={workspaceId} autoJoinCode={join} />;
}

export default function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; join?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs text-zinc-500">Loading training group...</p>
        </div>
      }
    >
      <GroupContentWrapper searchParams={searchParams} />
    </Suspense>
  );
}
