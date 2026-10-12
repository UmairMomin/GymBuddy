"use server";

import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/features/auth/schemas";
import { revalidatePath } from "next/cache";

export type AuthActionResult = {
  error?: string;
  success?: boolean;
};

// Internal helper: Map a clean username (e.g. "alex") to a valid internal email format
function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@gymbuddy.local`;
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const rawData = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  const validated = signInSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const supabase = await createClient();
  const email = usernameToEmail(validated.data.username);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: validated.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const rawData = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  const validated = signUpSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const username = validated.data.username.trim();
  const email = usernameToEmail(username);

  // Sign up user with auto-confirmed credentials
  const { data, error } = await supabase.auth.signUp({
    email,
    password: validated.data.password,
    options: {
      data: {
        display_name: username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If session wasn't immediately established by signup, sign in automatically
  if (!data.session) {
    await supabase.auth.signInWithPassword({
      email,
      password: validated.data.password,
    });
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
