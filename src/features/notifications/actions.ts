"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, SIGN_IN_REQUIRED } from "@/lib/supabase/require-user";
import { pushConfigured, sendToTargets } from "@/features/notifications/push";

export type ActionResult = { error?: string; success?: boolean };

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(2048),
  keys: z.object({ p256dh: z.string().min(10).max(512), auth: z.string().min(10).max(512) }),
});

export async function getPushStatusAction(): Promise<{ configured: boolean; publicKey: string | null }> {
  return { configured: pushConfigured(), publicKey: pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null : null };
}

export async function savePushSubscriptionAction(input: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { error: "This device sent an invalid notification subscription" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
  });
  if (error) return { error: "Couldn't turn on notifications" };
  return { success: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  const parsed = z.string().url().safeParse(endpoint);
  if (!parsed.success) return { error: "Invalid subscription" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data).eq("user_id", user.id);
  if (error) return { error: "Couldn't turn off notifications" };
  return { success: true };
}

/** Sends a test notification to my own registered devices. */
export async function sendTestPushAction(): Promise<ActionResult> {
  if (!pushConfigured()) return { error: "Notifications aren't set up on the server yet" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data: mine } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", user.id);
  if (!mine || mine.length === 0) return { error: "No device is registered for notifications" };

  const gone = await sendToTargets(mine, {
    title: "Gym Tracker",
    body: "Notifications are working. You'll hear about workout invites here.",
    url: "/",
    tag: "test",
  });
  if (gone.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", gone).eq("user_id", user.id);
    if (gone.length === mine.length) return { error: "That device's subscription expired. Turn notifications off and on again." };
  }
  return { success: true };
}
