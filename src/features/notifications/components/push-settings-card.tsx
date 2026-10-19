"use client";

import * as React from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPushStatusAction,
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/features/notifications/actions";
import { isIOSDevice, urlBase64ToUint8Array, useIsStandalone } from "@/lib/pwa";

type Status = "checking" | "unconfigured" | "needs-install" | "unsupported" | "denied" | "off" | "on";

export function PushSettingsCard() {
  const standalone = useIsStandalone();
  const [status, setStatus] = React.useState<Status>("checking");
  const [publicKey, setPublicKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const server = await getPushStatusAction();
      if (cancelled) return;
      setPublicKey(server.publicKey);
      if (!server.configured) return setStatus("unconfigured");

      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setStatus(isIOSDevice() && !standalone ? "needs-install" : "unsupported");
      if (Notification.permission === "denied") return setStatus("denied");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setStatus(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [standalone]);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setStatus(permission === "denied" ? "denied" : "off");
        if (!publicKey) return setMessage("Notifications aren't set up on the server yet.");

        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
        const res = await savePushSubscriptionAction(sub.toJSON());
        if (res.error) {
          setMessage(res.error);
          return;
        }
        setStatus("on");
      } catch {
        setMessage("Couldn't turn on notifications on this device.");
      }
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscriptionAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setStatus("off");
      } catch {
        setMessage("Couldn't turn off notifications.");
      }
    });
  }

  function sendTest() {
    setMessage(null);
    startTransition(async () => {
      const res = await sendTestPushAction();
      setMessage(res.error ?? "Test sent. It should arrive in a few seconds.");
    });
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-zinc-100">
          <Bell className="h-4 w-4 text-emerald-400" /> Notifications
        </CardTitle>
        <CardDescription className="text-xs text-zinc-400">
          Get a push when your buddy starts a workout and invites you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "checking" && <p className="text-sm text-zinc-400">Checking this device…</p>}
        {status === "unconfigured" && <p className="text-sm text-zinc-400">Not available yet: the server has no notification keys configured.</p>}
        {status === "needs-install" && (
          <p className="text-sm text-zinc-300">
            On iPhone, notifications only work after you add the app to your Home Screen: tap Share, then &ldquo;Add to Home Screen&rdquo;,
            then open it from there and come back to this page.
          </p>
        )}
        {status === "unsupported" && <p className="text-sm text-zinc-400">This browser doesn&rsquo;t support push notifications.</p>}
        {status === "denied" && (
          <p className="text-sm text-zinc-300">
            Notifications are blocked for this app. Allow them in your device settings (Settings → Notifications → Gym Tracker), then
            reload.
          </p>
        )}
        {status === "off" && (
          <Button onClick={enable} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Turn on notifications
          </Button>
        )}
        {status === "on" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={sendTest} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Send a test
            </Button>
            <Button variant="ghost" onClick={disable} disabled={pending}>
              <BellOff className="h-4 w-4" /> Turn off
            </Button>
          </div>
        )}
        {message && (
          <p role="status" className="text-sm text-zinc-300">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
