"use client";

import * as React from "react";
import { Check, Share, Smartphone, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isIOSDevice, useInstallPromptEvent, useIsStandalone } from "@/lib/pwa";

/**
 * Settings card for adding the app to the home screen. Unlike the dismissible home-page tip it is always
 * here: a native Install button where the browser offers one, Share → Add to Home Screen steps on iOS,
 * and a browser-menu hint everywhere else.
 */
export function InstallAppCard() {
  const standalone = useIsStandalone();
  const installEvent = useInstallPromptEvent();
  const ios = React.useSyncExternalStore(
    () => () => {},
    isIOSDevice,
    () => false
  );

  return (
    <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-zinc-100">
          <Smartphone className="h-4 w-4 text-emerald-400" /> Install app
        </CardTitle>
        <CardDescription className="text-xs text-zinc-400">
          Add GymBuddy to your home screen to open it full-screen like an app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {standalone ? (
          <p className="flex items-center gap-2 text-sm text-zinc-300">
            <Check aria-hidden className="h-4 w-4 text-emerald-400" /> You&rsquo;re using the installed app.
          </p>
        ) : installEvent ? (
          <Button
            onClick={async () => {
              await installEvent.prompt();
              await installEvent.userChoice;
            }}
          >
            <SquarePlus className="h-4 w-4" /> Add to home screen
          </Button>
        ) : ios ? (
          <p className="text-sm text-zinc-300">
            Open this page in Safari, tap <Share aria-label="Share" className="mx-0.5 inline h-4 w-4 align-text-bottom" /> Share, then{" "}
            <SquarePlus aria-hidden className="mx-0.5 inline h-4 w-4 align-text-bottom" /> Add to Home Screen.
          </p>
        ) : (
          <p className="text-sm text-zinc-400">
            Use your browser&rsquo;s menu and choose Install app or Add to Home Screen. If you don&rsquo;t see it, this browser may not
            support installing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
