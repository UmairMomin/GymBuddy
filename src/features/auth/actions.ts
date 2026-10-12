"use server";

import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/features/auth/schemas";
import { revalidatePath } from "next/cache";

export type AuthActionResult = {
  error?: string;
  success?: boolean;
};

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const validated = signInSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
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
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  };

  const validated = signUpSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      data: {
        display_name: validated.data.displayName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
