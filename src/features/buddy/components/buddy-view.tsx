"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptBuddyAction,
  removeBuddyLinkAction,
  requestBuddyAction,
  type BuddyOverview,
} from "@/features/buddy/actions";
import { cn, getInitials } from "@/lib/utils";

function Avatar({ name, tone = "accent" }: { name: string; tone?: "accent" | "muted" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold uppercase tracking-wide",
        tone === "accent" ? "bg-emerald-500 text-accent-ink" : "bg-zinc-800 text-zinc-300"
      )}
    >
      {getInitials(name)}
    </span>
  );
}

export function BuddyView({ overview }: { overview: BuddyOverview }) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const { buddy, incoming, outgoing, sharedSessions } = overview;

  function run(action: () => Promise<{ error?: string }>, onDone?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  function onRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    run(
      () => requestBuddyAction(username),
      () => {
        setNotice(`Request sent to @${username.trim().toLowerCase()}`);
        setUsername("");
      }
    );
  }

  function onRemoveBuddy() {
    if (!buddy) return;
    if (!confirm(`Remove ${buddy.displayName} as your buddy? Past shared sessions stay in both histories.`)) return;
    run(() => removeBuddyLinkAction(buddy.linkId));
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide">Buddy</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Train with one friend. Start a workout with them and you both log in the same live session.
        </p>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {incoming.length > 0 && (
        <section aria-labelledby="incoming-heading" className="space-y-2">
          <h2 id="incoming-heading" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Requests for you
          </h2>
          {incoming.map((r) => (
            <div key={r.linkId} className="flex items-center gap-3 rounded-2xl bg-zinc-900 p-3">
              <Avatar name={r.displayName} tone="muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-zinc-50">{r.displayName}</p>
                <p className="truncate text-xs text-zinc-400">@{r.username}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Decline ${r.displayName}`}
                disabled={pending}
                onClick={() => run(() => removeBuddyLinkAction(r.linkId))}
              >
                <X className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                aria-label={`Accept ${r.displayName}`}
                disabled={pending}
                onClick={() => run(() => acceptBuddyAction(r.linkId))}
              >
                <Check className="h-5 w-5" />
              </Button>
            </div>
          ))}
        </section>
      )}

      {buddy ? (
        <section aria-labelledby="buddy-heading" className="rounded-2xl bg-zinc-900 p-4">
          <h2 id="buddy-heading" className="sr-only">Your buddy</h2>
          <div className="flex items-center gap-3">
            <Avatar name={buddy.displayName} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-2xl font-bold uppercase tracking-wide">{buddy.displayName}</p>
              <p className="truncate text-xs text-zinc-400">@{buddy.username}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Remove buddy" disabled={pending} onClick={onRemoveBuddy}>
              <UserMinus className="h-5 w-5 text-zinc-400" />
            </Button>
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            Toggle &ldquo;Train with {buddy.displayName.split(" ")[0]}&rdquo; on the Today screen when you start a workout. They
            only ever see sessions you do together.
          </p>
        </section>
      ) : (
        <section aria-labelledby="add-heading" className="rounded-2xl bg-zinc-900 p-4">
          <h2 id="add-heading" className="font-display text-xl font-bold uppercase tracking-wide">
            Add your training buddy
          </h2>
          <p className="mt-1 text-sm text-zinc-400">Enter their exact username. They&rsquo;ll get a request to accept.</p>
          <form onSubmit={onRequest} className="mt-3 flex gap-2">
            <label htmlFor="buddy-username" className="sr-only">Buddy username</label>
            <Input
              id="buddy-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1"
            />
            <Button type="submit" disabled={pending || !username.trim()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Send
            </Button>
          </form>

          {outgoing.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="Pending requests">
              {outgoing.map((r) => (
                <li key={r.linkId} className="flex items-center gap-3 rounded-xl bg-zinc-950/60 p-2 pl-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">@{r.username}</p>
                    <p className="text-xs text-zinc-400">Waiting for them to accept</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => removeBuddyLinkAction(r.linkId))}
                  >
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {buddy && (
        <section aria-labelledby="shared-heading" className="space-y-2">
          <h2 id="shared-heading" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Trained together
          </h2>
          {sharedSessions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-400">
              No shared sessions yet.
            </p>
          ) : (
            sharedSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-2xl bg-zinc-900 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="text-xs text-zinc-400" suppressHydrationWarning>
                    {new Date(s.startedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    s.status === "in_progress" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                  )}
                >
                  {s.status === "in_progress" ? "Live" : s.status === "completed" ? "Done" : "Cancelled"}
                </span>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
