"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";

export function NetworkStatusIndicator() {
  const isOnline = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-zinc-950 px-3 py-1.5 text-center text-xs font-semibold flex items-center justify-center gap-2 shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Offline mode. Changes will be synced when your gym connection is restored.</span>
    </div>
  );
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
