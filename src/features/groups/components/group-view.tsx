"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  WorkspaceDetails,
  joinWorkspaceByCodeAction,
  createWorkspaceAction,
  removeMemberAction,
  leaveWorkspaceAction,
} from "@/features/groups/actions";
import {
  Users,
  Copy,
  Check,
  UserPlus,
  LogIn,
  Plus,
  Shield,
  User,
  Trash2,
  LogOut,
  Loader2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { useRouter } from "next/navigation";

export function GroupView({
  details,
  currentUserId,
  autoJoinCode,
}: {
  details: WorkspaceDetails;
  currentUserId: string;
  autoJoinCode?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);

  // Dialog States
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(Boolean(autoJoinCode));
  const [createOpen, setCreateOpen] = React.useState(false);

  // Form & Loading States
  const [joinCode, setJoinCode] = React.useState(autoJoinCode || "");
  const [newGroupName, setNewGroupName] = React.useState("");
  const [newGroupDesc, setNewGroupDesc] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  const isOwner = details.currentUserRole === "owner";
  const isAdminOrOwner = details.currentUserRole === "owner" || details.currentUserRole === "admin";

  const inviteCode = details.invite_code || "--------";

  function handleCopyInviteLink() {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}/group?join=${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyCodeOnly() {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const res = await joinWorkspaceByCodeAction(joinCode);
    setLoading(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess("Successfully joined workspace!");
      setJoinOpen(false);
      setJoinCode("");
      router.refresh();
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setLoading(true);
    setActionError(null);

    const res = await createWorkspaceAction(newGroupName, newGroupDesc);
    setLoading(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setCreateOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      router.refresh();
    }
  }

  async function handleRemoveMember(memberUserId: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name} from this training group?`)) return;
    setLoading(true);
    setActionError(null);

    const res = await removeMemberAction(details.id, memberUserId);
    setLoading(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
  }

  async function handleLeaveGroup() {
    if (!confirm("Are you sure you want to leave this training group?")) return;
    setLoading(true);
    setActionError(null);

    const res = await leaveWorkspaceAction(details.id);
    setLoading(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Workspace Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" />
            <span>Training Group</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Train together with your gym buddies, share splits, and collaborate live in sessions.
          </p>
        </div>

        {/* Workspaces Switcher if in multiple */}
        {details.allUserWorkspaces.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Group:</span>
            <select
              value={details.id}
              onChange={(e) => router.push(`/group?workspaceId=${e.target.value}`)}
              className="bg-zinc-900 border border-zinc-800 text-xs rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              {details.allUserWorkspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400 border border-emerald-500/20">
          <Check className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Active Group Details Card */}
      <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <span>{details.name}</span>
              </CardTitle>
              {details.description && (
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  {details.description}
                </CardDescription>
              )}
            </div>

            {/* Invite Code Badge with 1-click copy */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 font-mono text-xs">
                <span className="text-zinc-500 text-[11px] uppercase">Invite Code:</span>
                <span className="font-bold text-emerald-400 tracking-wider">{inviteCode}</span>
                <button
                  type="button"
                  onClick={handleCopyCodeOnly}
                  className="text-zinc-400 hover:text-zinc-100 transition-colors ml-1"
                  title="Copy code"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => setInviteOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold gap-1.5 text-xs h-9"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite Gym Buddy
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setJoinOpen(true)}
              className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 gap-1.5 text-xs h-9"
            >
              <LogIn className="h-3.5 w-3.5" />
              Join Another Group
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 gap-1.5 text-xs h-9"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Group
            </Button>

            {!isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeaveGroup}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5 text-xs h-9 ml-auto"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave Group
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Member Roster */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Group Members ({details.members.length})
          </h2>
        </div>

        <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-900/40">
          {details.members.map((member) => {
            const isSelf = member.user_id === currentUserId;
            const initials = member.profile.display_name
              ? member.profile.display_name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "TR";

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-zinc-900/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Initials Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-bold text-xs text-zinc-200 border border-zinc-700">
                    {initials}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-100">
                        {member.profile.display_name}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-medium">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500 font-mono">
                      {member.profile.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Role Badge */}
                  <div
                    className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium capitalize ${
                      member.role === "owner"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : member.role === "admin"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {member.role === "owner" ? (
                      <Shield className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                    <span>{member.role}</span>
                  </div>

                  {/* Remove Button for Owner/Admin */}
                  {isAdminOrOwner && !isSelf && member.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveMember(member.user_id, member.profile.display_name)
                      }
                      className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* DIALOG 1: Invite Partner */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-400" />
                <span>Invite Gym Buddy</span>
              </h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Share this invite code or link with your gym partner. Once they sign in and enter the code, they will immediately have access to log collaborative workouts and shared routines.
            </p>

            <div className="space-y-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Invite Code
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 font-mono text-center text-lg font-bold tracking-widest text-emerald-400">
                    {inviteCode}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyCodeOnly}
                    className="border-zinc-800 text-xs gap-1.5 h-11 px-3"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Shareable Invite Link
                </label>
                <div className="mt-1">
                  <Button
                    onClick={handleCopyInviteLink}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold text-xs gap-2 h-10"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? "Link Copied to Clipboard!" : "Copy Full Invite Link"}</span>
                  </Button>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              className="w-full border-zinc-800 text-xs"
            >
              Done
            </Button>
          </Card>
        </div>
      )}

      {/* DIALOG 2: Join Group with Code */}
      {joinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                <LogIn className="h-5 w-5 text-emerald-400" />
                <span>Join a Training Group</span>
              </h3>
              <button
                type="button"
                onClick={() => setJoinOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <p className="text-xs text-zinc-400">
                Enter the 8-character invite code provided by your workout partner or group owner.
              </p>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Invite Code</label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A13A6FE9"
                  maxLength={10}
                  className="mt-1 font-mono tracking-widest text-center uppercase bg-zinc-900 border-zinc-800 font-bold text-base h-11"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setJoinOpen(false)}
                  className="flex-1 border-zinc-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !joinCode.trim()}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold text-xs gap-1.5"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Join Group
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* DIALOG 3: Create New Group */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-400" />
                <span>Create New Training Group</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300">Group Name *</label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Morning Iron Crew"
                  className="mt-1 bg-zinc-900 border-zinc-800 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Description (Optional)</label>
                <Input
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. 6 AM strength & hypertrophy split"
                  className="mt-1 bg-zinc-900 border-zinc-800 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 border-zinc-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !newGroupName.trim()}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold text-xs gap-1.5"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
