"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInAction, signUpAction } from "@/features/auth/actions";
import { Dumbbell, Loader2, AlertCircle } from "lucide-react";

export function AuthForm() {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const action = isSignUp ? signUpAction : signInAction;
    const res = await action(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      // Return to the page the user originally asked for (set by the proxy), if it is a local path.
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(destination);
      router.refresh();
      // Next keeps this page's client state alive while you are signed in, so leave the form pristine for
      // the next visit (after logging out): not stuck "loading", not on the sign-up tab, no password left in the DOM.
      form.reset();
      setLoading(false);
      setIsSignUp(false);
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl max-w-sm mx-auto w-full">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
          <Dumbbell className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">
          {isSignUp ? "Create an account" : "Sign in to Gym Tracker"}
        </CardTitle>
        <CardDescription className="text-zinc-400 text-xs">
          {isSignUp
            ? "Tell us your name and pick a username and password"
            : "Enter your username and password to continue"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300" htmlFor="name">
                Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="e.g. Alex Carter"
                required
                minLength={2}
                maxLength={60}
                disabled={loading}
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300" htmlFor="username">
              Username
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="e.g. alex_lift"
              required
              disabled={loading}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete={isSignUp ? "new-password" : "current-password"}
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-bold h-11"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSignUp ? (
              "Sign Up"
            ) : (
              "Sign In"
            )}
          </Button>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="min-h-[44px] px-3 text-sm font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-50"
            >
              {isSignUp
                ? "Already have an account? Sign In"
                : "Need an account? Sign Up"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
