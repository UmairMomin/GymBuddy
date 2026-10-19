"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  declineWorkoutAction,
  getPendingInvitesAction,
  joinWorkoutAction,
  type PendingInvite,
} from "@/features/workout/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Global banner for workout invitations. Fetches pending invites, then keeps them fresh from Realtime
 * (an invite is a `session_participants` row for me), and again whenever the app returns to the foreground
 * (iOS suspends PWAs in the background, so a socket event may have been missed).
 */
export function InviteBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [invites, setInvites] = React.useState<PendingInvite[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const hidden = pathname === "/login";

  React.useEffect(() => {
    if (hidden) return;
    const supabase = createClient();
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const load = async () => {
      const res = await getPendingInvitesAction();
      if (!cancelled) setInvites(res.data?.invites ?? []);
      return res.data?.userId;
    };

    (async () => {
      const userId = await load();
      if (!userId || cancelled) return;
      await supabase.realtime.setAuth();
      if (cancelled) return;

      const channel = supabase
        .channel(`invites:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "session_participants", filter: `user_id=eq.${userId}` },
          () => void load()
        )
        .subscribe();

      const onVisible = () => {
        if (document.visibilityState === "visible") void load();
      };
      document.addEventListener("visibilitychange", onVisible);
      cleanup = () => {
        document.removeEventListener("visibilitychange", onVisible);
        void supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [hidden]);

  // Already inside that workout's invite screen: it has its own Join / Decline.
  const visible = invites.filter((i) => pathname !== `/session/${i.sessionId}`);
  if (hidden || visible.length === 0) return null;
  const invite = visible[0];

  async function join() {
    setBusyId(invite.sessionId);
    setError(null);
    const res = await joinWorkoutAction(invite.sessionId);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInvites((cur) => cur.filter((i) => i.sessionId !== invite.sessionId));
    router.push(`/session/${invite.sessionId}`);
  }

  async function decline() {
    setBusyId(invite.sessionId);
    setError(null);
    const res = await declineWorkoutAction(invite.sessionId);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInvites((cur) => cur.filter((i) => i.sessionId !== invite.sessionId));
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-[55] mx-auto max-w-xl rounded-2xl border border-[#a8cbff]/60 bg-zinc-900 p-3 shadow-2xl"
    >
      <p className="text-sm font-semibold text-zinc-50">
        {invite.hostName} started {invite.name}
      </p>
      <p className="text-xs text-zinc-400">Join them and log together in the same live workout.</p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button className="flex-1" disabled={busyId !== null} onClick={join}>
          {busyId === invite.sessionId && <Loader2 className="h-4 w-4 animate-spin" />} Join
        </Button>
        <Button variant="secondary" className="flex-1" disabled={busyId !== null} onClick={decline}>
          Decline
        </Button>
      </div>
    </div>
  );
}
