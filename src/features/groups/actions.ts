"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult<T = unknown> = {
  data?: T;
  error?: string;
  success?: boolean;
};

export type WorkspaceMemberItem = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  profile: {
    id: string;
    display_name: string;
    email: string;
    avatar_url: string | null;
  };
};

export type WorkspaceDetails = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string | null;
  created_at: string;
  currentUserRole: "owner" | "admin" | "member";
  members: WorkspaceMemberItem[];
  allUserWorkspaces: Array<{ id: string; name: string }>;
};

/**
 * Fetch workspace details and member roster for the specified or default workspace
 */
export async function getWorkspaceDetailsAction(
  workspaceId?: string
): Promise<ActionResult<WorkspaceDetails>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in to access group information" };
  }

  // 1. Fetch all workspaces user is a member of
  const { data: userMemberships, error: memError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces (id, name, description, created_by, invite_code, created_at)")
    .eq("user_id", user.id);

  if (memError) {
    return { error: memError.message };
  }

  if (!userMemberships || userMemberships.length === 0) {
    return { error: "No workspaces found for current user" };
  }

  // Select target workspace
  let targetMembership = userMemberships[0];
  if (workspaceId) {
    const found = userMemberships.find((m) => m.workspace_id === workspaceId);
    if (found) targetMembership = found;
  }

  const ws = targetMembership.workspaces;
  if (!ws) {
    return { error: "Target workspace could not be resolved" };
  }

  // 2. Fetch all members of this target workspace with their profiles
  const { data: memberRows, error: memberFetchError } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, joined_at, profiles (id, display_name, email, avatar_url)")
    .eq("workspace_id", ws.id)
    .order("joined_at", { ascending: true });

  if (memberFetchError) {
    return { error: memberFetchError.message };
  }

  const members: WorkspaceMemberItem[] = (memberRows || []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role as "owner" | "admin" | "member",
    joined_at: row.joined_at,
    profile: {
      id: row.profiles?.id || row.user_id,
      display_name: row.profiles?.display_name || "Trainee",
      email: row.profiles?.email || "",
      avatar_url: row.profiles?.avatar_url || null,
    },
  }));

  const allUserWorkspaces = userMemberships
    .filter((m) => m.workspaces)
    .map((m) => ({
      id: m.workspaces!.id,
      name: m.workspaces!.name,
    }));

  return {
    data: {
      id: ws.id,
      name: ws.name,
      description: ws.description,
      created_by: ws.created_by,
      invite_code: ws.invite_code,
      created_at: ws.created_at,
      currentUserRole: targetMembership.role as "owner" | "admin" | "member",
      members,
      allUserWorkspaces,
    },
  };
}

/**
 * Join a workspace via invite code
 */
export async function joinWorkspaceByCodeAction(inviteCode: string): Promise<ActionResult> {
  const code = inviteCode.trim();
  if (!code) {
    return { error: "Please provide a valid invite code" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in to join a group" };
  }

  const { data, error } = await supabase.rpc("join_workspace_by_invite_code", {
    _invite_code: code,
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as {
    error?: string;
    success?: boolean;
    workspace_id?: string;
    workspace_name?: string;
    already_member?: boolean;
  };

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/group");
  revalidatePath("/");
  revalidatePath("/routines");
  return {
    success: true,
    data: {
      workspaceId: result.workspace_id,
      workspaceName: result.workspace_name,
      alreadyMember: result.already_member,
    },
  };
}

/**
 * Create a new workspace / training group
 */
export async function createWorkspaceAction(
  name: string,
  description?: string
): Promise<ActionResult<{ workspaceId: string }>> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { error: "Group name must be at least 2 characters long" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in to create a group" };
  }

  const { data: newWs, error: createError } = await supabase
    .from("workspaces")
    .insert({
      name: trimmedName,
      description: description?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (createError) {
    return { error: createError.message };
  }

  // Add creator as owner
  await supabase.from("workspace_members").insert({
    workspace_id: newWs.id,
    user_id: user.id,
    role: "owner",
  });

  revalidatePath("/group");
  revalidatePath("/");
  revalidatePath("/routines");
  return { success: true, data: { workspaceId: newWs.id } };
}

/**
 * Remove a member from the workspace (Owner/Admin only)
 */
export async function removeMemberAction(
  workspaceId: string,
  memberUserId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  if (user.id === memberUserId) {
    return { error: "Cannot remove yourself with this action. Use Leave Group instead." };
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/group");
  return { success: true };
}

/**
 * Leave a workspace (for non-owners or when multiple owners exist)
 */
export async function leaveWorkspaceAction(workspaceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  // Check if user is sole owner
  const { data: members } = await supabase
    .from("workspace_members")
    .select("role, user_id")
    .eq("workspace_id", workspaceId);

  const owners = members?.filter((m) => m.role === "owner") || [];
  if (owners.length === 1 && owners[0].user_id === user.id) {
    return {
      error: "You are the sole owner of this group. Transfer ownership before leaving.",
    };
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/group");
  revalidatePath("/");
  return { success: true };
}
