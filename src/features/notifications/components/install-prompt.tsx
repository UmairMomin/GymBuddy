"use client";

import * as React from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIOSDevice, useInstallPromptEvent, useIsStandalone } from "@/lib/pwa";

const KEY = "gt-install-dismissed";
const EVENT = "gt-install-dismissed-change";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Nudges phone users to install the app (it is the "mobile app"): iOS gets Share → Add to Home Screen
 * steps, Chromium gets the native install prompt. Hidden once installed or dismissed.
 */
export function InstallPrompt() {
  const standalone = useIsStandalone();
  const installEvent = useInstallPromptEvent();
  const dismissed = React.useSyncExternalStore(subscribeDismissed, readDismissed, () => true);
  const ios = React.useSyncExternalStore(
    () => () => {},
    isIOSDevice,
    () => false
  );

  if (standalone || dismissed || (!ios && !installEvent)) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // private mode: it will simply show again next visit
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <section aria-label="Install the app" className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-4 pr-12">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install tip"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-sm font-semibold text-zinc-50">Install Gym Tracker</p>
      {ios ? (
        <p className="mt-1 text-sm text-zinc-400">
          Open this page in Safari, tap <Share aria-label="Share" className="mx-0.5 inline h-4 w-4 align-text-bottom" /> Share, then{" "}
          <SquarePlus aria-hidden className="mx-0.5 inline h-4 w-4 align-text-bottom" /> Add to Home Screen. It opens full-screen like an
          app and can send you workout invites.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-400">Add it to your home screen to open it like an app.</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={async () => {
              await installEvent?.prompt();
              await installEvent?.userChoice;
            }}
          >
            Install
          </Button>
        </>
      )}
    </section>
  );
}
