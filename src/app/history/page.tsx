import { Suspense } from "react";
import { PageLoader } from "@/components/ui/loaders";
import { connection } from "next/server";
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
      fallback={<PageLoader label="Loading your history…" />}
    >
      <HistoryContent />
    </Suspense>
  );
}
