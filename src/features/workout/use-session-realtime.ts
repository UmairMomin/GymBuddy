"use client";

import * as React from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { SetRow } from "@/features/workout/actions";

export type ConnectionStatus = "connecting" | "live" | "reconnecting";

export type Peer = { userId: string; name: string; exerciseId: string | null };

export type SetChange =
  | { kind: "upsert"; set: SetRow }
  | { kind: "delete"; id: string };

type Handlers = {
  onSetChange: (change: SetChange) => void;
  /** Participants / session row changed: roster or status may be stale. */
  onRosterChange: () => void;
  /** Connection (re)established: fetch an authoritative snapshot. */
  onResync: () => void;
};

/**
 * One private Realtime channel per session (`session:<id>`), authorized by RLS on realtime.messages so
 * only the session's members can join. Carries row changes and presence.
 * State is never trusted from the wire alone: every (re)connect triggers `onResync`.
 */
export function useSessionRealtime(
  opts: { sessionId: string; userId: string; name: string; enabled: boolean } & Handlers
) {
  const { sessionId, userId, name, enabled } = opts;
  const handlers = React.useRef<Handlers>(opts);
  React.useEffect(() => {
    handlers.current = opts;
  });

  const [status, setStatus] = React.useState<ConnectionStatus>("connecting");
  const [peers, setPeers] = React.useState<Peer[]>([]);
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const lastExercise = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      // Private channels authorize with the signed-in user's JWT.
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel = supabase.channel(`session:${sessionId}`, {
        config: { private: true, presence: { key: userId } },
      });

      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "workout_sets", filter: `session_id=eq.${sessionId}` },
          (payload: RealtimePostgresChangesPayload<SetRow>) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as Partial<SetRow>).id;
              if (id) handlers.current.onSetChange({ kind: "delete", id });
            } else {
              handlers.current.onSetChange({ kind: "upsert", set: payload.new as SetRow });
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "session_participants", filter: `session_id=eq.${sessionId}` },
          () => handlers.current.onRosterChange()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "session_exercises", filter: `session_id=eq.${sessionId}` },
          () => handlers.current.onRosterChange()
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "workout_sessions", filter: `id=eq.${sessionId}` },
          () => handlers.current.onRosterChange()
        )
        .on("presence", { event: "sync" }, () => {
          const state = channel?.presenceState<{ userId: string; name: string; exerciseId: string | null }>() ?? {};
          const others = Object.values(state)
            .flat()
            .filter((p) => p.userId !== userId)
            .map((p) => ({ userId: p.userId, name: p.name, exerciseId: p.exerciseId }));
          setPeers(others);
        })
        .subscribe((s) => {
          if (cancelled) return;
          if (s === "SUBSCRIBED") {
            setStatus("live");
            void channel?.track({ userId, name, exerciseId: lastExercise.current });
            // First connect and every reconnect: don't trust that no event was missed.
            handlers.current.onResync();
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            setStatus("reconnecting");
            setPeers([]);
          }
        });
      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, userId, name, enabled]);

  const track = React.useCallback(
    (exerciseId: string | null) => {
      lastExercise.current = exerciseId;
      void channelRef.current?.track({ userId, name, exerciseId });
    },
    [userId, name]
  );


  return { status, peers, track };
}
