"use client";

import { User } from "lucide-react";
import { LoadingScreen } from "@/components/ui/loaders";

/** Full-screen wait while joining someone's workout: you and them, joined by a dot passing between. */
export function JoiningScreen({ hostName }: { hostName: string }) {
  const first = hostName.split(" ")[0] || hostName;
  return (
    <LoadingScreen
      title={`Joining ${first}'s workout`}
      subtitle="You'll get a copy of their exercises. Your sets stay your own."
      steps={[`Connecting to ${first}`, "Copying their exercises"]}
    >
      <div aria-hidden className="flex items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-accent-ink">
          <User className="h-6 w-6" />
        </span>
        <span className="relative mx-2.5 h-2.5 flex-1">
          <span className="absolute inset-x-0 top-1 border-t-2 border-dashed border-zinc-700" />
          <span className="gb-pass absolute top-0 h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#a8cbff] font-display text-xl font-extrabold text-[#1e1e22]">
          {first.slice(0, 1).toUpperCase()}
        </span>
      </div>
    </LoadingScreen>
  );
}
