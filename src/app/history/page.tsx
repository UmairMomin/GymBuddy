import { Suspense } from "react";
import { connection } from "next/server";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHistoryAction } from "@/features/history/actions";
import { HistoryView } from "@/features/history/components/history-view";

async function HistoryContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // the proxy redirects signed-out visitors to /login

  const res = await getHistoryAction();
  if (!res.data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-400">
        <p>{res.error ?? "Unable to load your history"}</p>
      </div>
    );
  }
  return <HistoryView data={res.data} />;
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs text-zinc-500">Loading your history...</p>
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
