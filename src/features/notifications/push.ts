import "server-only";
import webpush from "web-push";
import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

let configured: boolean | null = null;

/** VAPID keys live in env. Without them push is simply off; invites still arrive in-app. */
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@example.com";
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return configure();
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };

type Target = { endpoint: string; p256dh: string; auth: string };

/** Send to a list of subscriptions. Returns endpoints the push service says are gone (404/410). */
export async function sendToTargets(targets: Target[], message: PushMessage): Promise<string[]> {
  if (!configure() || targets.length === 0) return [];
  const gone: string[] = [];
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify(message),
          { TTL: 900, urgency: "high" }
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(t.endpoint);
        else console.error("[push] send failed", status ?? "unknown");
      }
    })
  );
  return gone;
}

/**
 * Best-effort "X started a workout" push to the buddy invited to this session. Never throws:
 * the invite itself is a database row and is also delivered in-app and via the share link.
 * Targets come from a DB function scoped to my own live session, never from the client.
 */
export async function sendInvitePush(supabase: Supa, sessionId: string, hostName: string, sessionName: string) {
  try {
    if (!configure()) return;
    const { data: targets } = await supabase.rpc("invited_push_targets", { p_session_id: sessionId });
    if (!targets || targets.length === 0) return;
    const gone = await sendToTargets(targets, {
      title: `${hostName} started ${sessionName}`,
      body: "Tap to join the live workout.",
      url: `/session/${sessionId}`,
      tag: `invite-${sessionId}`,
    });
    await Promise.all(gone.map((endpoint) => supabase.rpc("prune_push_subscription", { p_session_id: sessionId, p_endpoint: endpoint })));
  } catch (error) {
    console.error("[push] invite push failed", error instanceof Error ? error.message : "unknown");
  }
}
