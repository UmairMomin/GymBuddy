import { Suspense } from "react";
import { RoutinesContent } from "@/features/routines/components/routines-content";
import { Loader2 } from "lucide-react";

export default function RoutinesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs text-zinc-500">Loading routines and movements...</p>
        </div>
      }
    >
      <RoutinesContent />
    </Suspense>
  );
}
