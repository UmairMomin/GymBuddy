"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Open sheets, oldest first. Escape only closes the topmost one. */
const openSheets: symbol[] = [];

/**
 * Bottom sheet on phones, centered dialog on larger screens. Closes on Escape and backdrop tap,
 * locks body scroll and returns focus to the previously focused element.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;
    const id = Symbol("sheet");
    openSheets.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && openSheets[openSheets.length - 1] === id) onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openSheets.splice(openSheets.indexOf(id), 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div aria-hidden className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-zinc-950 shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl sm:border sm:border-zinc-800",
          className
        )}
      >
        <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <h2 id={titleId} className="font-display text-2xl font-extrabold uppercase tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <footer className="border-t border-zinc-800 p-4 pb-safe">{footer}</footer>}
      </div>
    </div>
  );
}
