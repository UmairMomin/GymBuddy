import { Suspense } from "react";
import { PageLoader } from "@/components/ui/loaders";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayAction } from "@/features/workout/actions";
import { TodayView } from "@/features/workout/components/today-view";

async function TodayContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // the proxy redirects signed-out visitors to /login

  const res = await getTodayAction();
  if (!res.data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-400">
        <p>{res.error ?? "Unable to load Today"}</p>
      </div>
    );
  }
  return <TodayView data={res.data} />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={<PageLoader label="Loading today…" />}
    >
      <TodayContent />
    </Suspense>
  );
}
