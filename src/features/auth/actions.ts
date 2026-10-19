"use server";

import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/features/auth/schemas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
    return { error: friendlySignInError(error.message) };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// Same message for "no such user" and "wrong password" so the form doesn't reveal which usernames exist.
function friendlySignInError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return "Incorrect username or password. Check them and try again.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (m.includes("fetch") || m.includes("network")) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return "Couldn't sign you in right now. Please try again.";
}

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const rawData = {
    name: formData.get("name"),
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
        // Shown in the app (profile menu, group, sessions); the username is only the login id.
        display_name: validated.data.name,
      },
    },
  });

  if (error) {
    return { error: friendlySignUpError(error.message) };
  }

  // Supabase answers an already-registered address with an obfuscated user that has no identities.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: "That username is already taken. Try another one or sign in." };
  }

  // If session wasn't immediately established by signup, sign in automatically
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: validated.data.password,
    });
    if (signInError) {
      return {
        error: `Account created, but automatic sign-in failed (${signInError.message}). Please sign in.`,
      };
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

function friendlySignUpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "That username is already taken. Try another one or sign in.";
  }
  if (m.includes("rate limit")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return message;
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
