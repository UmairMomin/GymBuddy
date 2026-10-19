"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult<T = unknown> = {
  data?: T;
  error?: string;
  success?: boolean;
};

export type UserProfileSettings = {
  id: string;
  email: string;
  displayName: string;
  preferredUnit: "kg" | "lb";
};

/**
 * Fetch current user's profile settings
 */
export async function getUserProfileSettingsAction(): Promise<ActionResult<UserProfileSettings>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, preferred_unit")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return {
      data: {
        id: user.id,
        email: user.email || "",
        displayName: user.user_metadata?.display_name || user.email?.split("@")[0] || "Trainee",
        preferredUnit: "kg",
      },
    };
  }

  return {
    data: {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      preferredUnit: (profile.preferred_unit as "kg" | "lb") || "kg",
    },
  };
}

/**
 * Update preferred weight unit (kg or lb)
 */
export async function updatePreferredUnitAction(unit: "kg" | "lb"): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ preferred_unit: unit })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/analytics");
  return { success: true };
}

/**
 * Update user display name
 */
export async function updateProfileDisplayNameAction(displayName: string): Promise<ActionResult> {
  const name = displayName.trim();
  if (!name || name.length < 2) {
    return { error: "Display name must be at least 2 characters long" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Also update auth user metadata
  await supabase.auth.updateUser({
    data: { display_name: name },
  });

  revalidatePath("/", "layout");
  return { success: true };
}
