"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  console.error(error);
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-zinc-300">Something went wrong. Your session may have expired or the connection dropped.</p>
      <Button onClick={() => retry()}>Try again</Button>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        Reload app
      </Button>
    </div>
  );
}
