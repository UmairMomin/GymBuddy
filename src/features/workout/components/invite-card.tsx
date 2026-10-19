"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { declineWorkoutAction, joinWorkoutAction } from "@/features/workout/actions";

/** Full-page confirmation shown to an invited buddy. Nothing about the workout is revealed until they join. */
export function InviteCard({ sessionId, name, hostName }: { sessionId: string; name: string; hostName: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function join() {
    setError(null);
    startTransition(async () => {
      const res = await joinWorkoutAction(sessionId);
      if (res.error) return setError(res.error);
      router.refresh(); // the page now resolves to the live workout
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      const res = await declineWorkoutAction(sessionId);
      if (res.error) return setError(res.error);
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-sm flex-col items-center justify-center gap-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Workout invite</p>
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide">{name}</h1>
      <p className="text-sm text-zinc-400">
        {hostName} wants you to train with them. You&rsquo;ll each log your own sets in one live workout.
      </p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex w-full flex-col gap-2">
        <Button size="lg" disabled={pending} onClick={join}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Join workout
        </Button>
        <Button variant="secondary" disabled={pending} onClick={decline}>
          Decline
        </Button>
        <Link href="/" className="text-xs text-zinc-500 underline-offset-4 hover:underline">
          Decide later
        </Link>
      </div>
    </div>
  );
}
