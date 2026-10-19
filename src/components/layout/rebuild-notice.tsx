import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Placeholder for screens that are being rebuilt for the solo + buddy model (see
 * docs/IMPLEMENTATION_PLAN.md). Remove usages as the owning milestone lands.
 */
export function RebuildNotice({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide">{title}</h1>
      <p className="text-sm text-zinc-400">
        This screen is being rebuilt for the new solo + buddy workflow ({milestone}). Meanwhile you can plan your week
        and link up with your buddy.
      </p>
      <div className="flex w-full gap-2 pt-1">
        <Link href="/plan" className="flex-1">
          <Button className="w-full">Plan</Button>
        </Link>
        <Link href="/buddy" className="flex-1">
          <Button variant="secondary" className="w-full">Buddy</Button>
        </Link>
      </div>
    </div>
  );
}
