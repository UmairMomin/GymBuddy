"use client";

import * as React from "react";

/** Registers the service worker (push only; it caches nothing). Renders nothing. */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Non-fatal: the app works without it; only background notifications are unavailable.
    });
  }, []);
  return null;
}
