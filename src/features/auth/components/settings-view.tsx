"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  UserProfileSettings,
  updatePreferredUnitAction,
  updateProfileDisplayNameAction,
} from "@/features/auth/settings-actions";
import { signOutAction } from "@/features/auth/actions";
import {
  Settings,
  Scale,
  User,
  Download,
  LogOut,
  Check,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppearanceCard } from "@/features/auth/components/appearance-card";

export function SettingsView({ initialSettings }: { initialSettings: UserProfileSettings }) {
  const router = useRouter();
  const [preferredUnit, setPreferredUnit] = React.useState<"kg" | "lb">(
    initialSettings.preferredUnit
  );
  const [displayName, setDisplayName] = React.useState(initialSettings.displayName);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  async function handleUnitChange(unit: "kg" | "lb") {
    if (unit === preferredUnit) return;
    setPreferredUnit(unit);
    const res = await updatePreferredUnitAction(unit);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: `Preferred weight unit updated to ${unit.toUpperCase()}` });
      setTimeout(() => setMessage(null), 3000);
      router.refresh();
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLoading(true);
    setMessage(null);

    const res = await updateProfileDisplayNameAction(displayName);
    setLoading(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setIsEditingName(false);
      setMessage({ type: "success", text: "Display name updated successfully" });
      setTimeout(() => setMessage(null), 3000);
      router.refresh();
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await signOutAction();
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-emerald-400" />
          <span>App Settings</span>
        </h1>
        <p className="text-sm text-zinc-400">
          Manage your weight units, workout logging preferences, and account details.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-xs border ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}
        >
          {message.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <AppearanceCard />

      {/* UNIT PREFERENCE CARD */}
      <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Scale className="h-4 w-4 text-emerald-400" />
            <span>Weight Display Unit</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Choose whether to log and view weights in kilograms (kg) or pounds (lb). Weights are safely stored in canonical units without precision loss.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleUnitChange("kg")}
              className={`flex flex-col items-center justify-center rounded-xl p-4 border transition-all text-center ${
                preferredUnit === "kg"
                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10 font-bold"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span className="text-lg font-bold font-mono">Kilograms (kg)</span>
              <span className="text-[11px] text-zinc-500 mt-0.5">Metric Standard (0.5 kg plates)</span>
            </button>

            <button
              type="button"
              onClick={() => handleUnitChange("lb")}
              className={`flex flex-col items-center justify-center rounded-xl p-4 border transition-all text-center ${
                preferredUnit === "lb"
                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10 font-bold"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span className="text-lg font-bold font-mono">Pounds (lb)</span>
              <span className="text-[11px] text-zinc-500 mt-0.5">Imperial (2.5 lb plates)</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* PROFILE DETAILS CARD */}
      <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-400" />
            <span>Profile & Account</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Your identity as shown to your training buddy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-400">Username</label>
            <p className="text-sm font-mono text-zinc-200 mt-0.5">@{initialSettings.username}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400">Display Name</label>
            {!isEditingName ? (
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold text-zinc-100">{displayName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingName(true)}
                  className="text-xs text-emerald-400 h-8 hover:text-emerald-300"
                >
                  Edit
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSaveName} className="flex gap-2 mt-1">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-sm h-9"
                  required
                />
                <Button
                  type="submit"
                  disabled={loading}
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-bold text-xs h-9"
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDisplayName(initialSettings.displayName);
                    setIsEditingName(false);
                  }}
                  className="border-zinc-800 text-xs h-9"
                >
                  Cancel
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>

      {/* DATA EXPORT CARD */}
      <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Data Ownership & Export</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Download your full workout history, exercises, weights, and set records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/api/export?format=csv" download>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-200 hover:text-zinc-50 text-xs h-9"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                Export Spreadsheet (CSV)
              </Button>
            </a>
            <a href="/api/export?format=json" download>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-800 bg-zinc-950 text-zinc-200 hover:text-zinc-50 text-xs h-9"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                Export Raw Data (JSON)
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* SIGN OUT ACTION */}
      <div className="pt-2">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          disabled={loading}
          className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 h-10 gap-2 text-xs font-semibold"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sign Out of Gym Tracker
        </Button>
      </div>
    </div>
  );
}
