"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { renameSessionAction } from "@/features/workout/actions";
import { cn } from "@/lib/utils";

/** Pencil button + sheet to rename a freestyle workout. Render it only for freestyle sessions. */
export function RenameSession({ sessionId, name, className }: { sessionId: string; name: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(name);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await renameSessionAction(sessionId, value);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Rename workout"
        onClick={() => {
          setValue(name);
          setError(null);
          setOpen(true);
        }}
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100", className)}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Rename workout"
        footer={
          <Button className="w-full" disabled={pending || value.trim() === ""} onClick={save}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        }
      >
        <form
          className="space-y-2 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input aria-label="Workout name" value={value} maxLength={80} autoFocus onChange={(e) => setValue(e.target.value)} />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        </form>
      </Sheet>
    </>
  );
}
