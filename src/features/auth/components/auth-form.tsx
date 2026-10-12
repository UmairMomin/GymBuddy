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
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData(e.currentTarget);
    const action = isSignUp ? signUpAction : signInAction;
    const res = await action(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      if (isSignUp) {
        setSuccessMsg("Account created! If email confirmation is required, please check your inbox.");
        setLoading(false);
      } else {
        router.refresh();
      }
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl max-w-sm mx-auto">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
          <Dumbbell className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">
          {isSignUp ? "Create your account" : "Sign in to Gym Tracker"}
        </CardTitle>
        <CardDescription className="text-zinc-400">
          {isSignUp
            ? "Track workouts with your training group"
            : "Continue where you left off with your partners"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400 border border-emerald-500/20">
              {successMsg}
            </div>
          )}

          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300" htmlFor="displayName">
                Display Name
              </label>
              <Input
                id="displayName"
                name="displayName"
                type="text"
                placeholder="e.g. Alex"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="alex@example.com"
              required
              disabled={loading}
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
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold"
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

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline"
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
