"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, SIGN_IN_REQUIRED } from "@/lib/supabase/require-user";
import { buddyUsernameSchema, linkIdSchema } from "@/features/buddy/schemas";

export type ActionResult<T = unknown> = { data?: T; error?: string; success?: boolean };

export type BuddyPerson = { id: string; username: string; displayName: string };

export type SharedSession = {
  id: string;
  name: string;
  status: string;
  startedAt: string;
};

export type BuddyOverview = {
  /** The accepted buddy, if any. */
  buddy: (BuddyPerson & { linkId: string; since: string | null }) | null;
  /** Requests other people sent to me. */
  incoming: Array<BuddyPerson & { linkId: string }>;
  /** Requests I sent that are still waiting. */
  outgoing: Array<BuddyPerson & { linkId: string }>;
  /** Most recent sessions done together (empty until a buddy is linked). */
  sharedSessions: SharedSession[];
};

/** Postgres RAISE messages from our RPCs are user-safe; anything else gets a generic message. */
function rpcMessage(error: { message: string; code?: string }): string {
  return error.code === "P0001" ? error.message : "Something went wrong. Please try again.";
}

export async function getBuddyOverviewAction(): Promise<ActionResult<BuddyOverview>> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data: links, error } = await supabase
    .from("buddy_links")
    .select("id, requester_id, addressee_id, status, responded_at");
  if (error) return { error: "Couldn't load your buddy" };

  const otherId = (l: { requester_id: string; addressee_id: string }) =>
    l.requester_id === user.id ? l.addressee_id : l.requester_id;

  const ids = [...new Set((links ?? []).map(otherId))];
  const people = new Map<string, BuddyPerson>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", ids);
    for (const p of profiles ?? []) {
      people.set(p.id, { id: p.id, username: p.username, displayName: p.display_name });
    }
  }
  const person = (id: string): BuddyPerson =>
    people.get(id) ?? { id, username: "unknown", displayName: "Unknown" };

  const overview: BuddyOverview = { buddy: null, incoming: [], outgoing: [], sharedSessions: [] };
  for (const l of links ?? []) {
    const other = person(otherId(l));
    if (l.status === "accepted") {
      overview.buddy = { ...other, linkId: l.id, since: l.responded_at };
    } else if (l.addressee_id === user.id) {
      overview.incoming.push({ ...other, linkId: l.id });
    } else {
      overview.outgoing.push({ ...other, linkId: l.id });
    }
  }

  if (overview.buddy) {
    // Sessions both of us took part in. RLS already limits sessions to ones I can see.
    const { data: theirs } = await supabase
      .from("session_participants")
      .select("session_id")
      .eq("user_id", overview.buddy.id)
      .in("status", ["joined", "left"]);
    const sessionIds = (theirs ?? []).map((r) => r.session_id);
    if (sessionIds.length > 0) {
      const { data: sessions } = await supabase
        .from("workout_sessions")
        .select("id, name, status, started_at")
        .in("id", sessionIds)
        .order("started_at", { ascending: false })
        .limit(10);
      overview.sharedSessions = (sessions ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startedAt: s.started_at,
      }));
    }
  }

  return { data: overview };
}

export async function requestBuddyAction(username: string): Promise<ActionResult> {
  const parsed = buddyUsernameSchema.safeParse(username);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid username" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("request_buddy", { p_username: parsed.data });
  if (error) return { error: rpcMessage(error) };

  revalidatePath("/buddy");
  return { success: true };
}

export async function acceptBuddyAction(linkId: string): Promise<ActionResult> {
  const parsed = linkIdSchema.safeParse(linkId);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("accept_buddy", { p_link_id: parsed.data });
  if (error) return { error: rpcMessage(error) };

  revalidatePath("/buddy");
  return { success: true };
}

/** Decline an incoming request, cancel an outgoing one, or remove the buddy: all delete the link. */
export async function removeBuddyLinkAction(linkId: string): Promise<ActionResult> {
  const parsed = linkIdSchema.safeParse(linkId);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.from("buddy_links").delete().eq("id", parsed.data);
  if (error) return { error: "Couldn't update that request" };

  revalidatePath("/buddy");
  return { success: true };
}
