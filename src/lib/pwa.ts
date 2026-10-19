"use client";

import * as React from "react";

/** Subset of the (non-standard) `beforeinstallprompt` event used on Chromium. */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const subscribers = new Set<() => void>();
let deferredPrompt: InstallPromptEvent | null = null;
let listening = false;

function notify() {
  subscribers.forEach((fn) => fn());
}

function ensureListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

function subscribe(fn: () => void) {
  ensureListening();
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Chromium's saved install prompt, if the browser offered one. null on iOS Safari and when installed. */
export function useInstallPromptEvent(): InstallPromptEvent | null {
  return React.useSyncExternalStore(
    subscribe,
    () => deferredPrompt,
    () => null
  );
}

function standaloneSnapshot(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** True when running as an installed app (home screen). False on the server and before hydration. */
export function useIsStandalone(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    standaloneSnapshot,
    () => false
  );
}

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports as "Macintosh" with touch support.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Decode a VAPID public key (URL-safe base64) for PushManager.subscribe. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
