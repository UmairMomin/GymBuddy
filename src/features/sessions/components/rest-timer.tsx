"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";

export function RestTimer() {
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [selectedDuration, setSelectedDuration] = React.useState<number>(90);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && secondsLeft !== null && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev === null || prev <= 1) {
            setIsRunning(false);
            if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
              try {
                navigator.vibrate([200, 100, 200]);
              } catch {
                // ignore
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, secondsLeft]);

  function startTimer(duration: number) {
    setSelectedDuration(duration);
    setSecondsLeft(duration);
    setIsRunning(true);
  }

  function toggleRunning() {
    setIsRunning(!isRunning);
  }

  function resetTimer() {
    setIsRunning(false);
    setSecondsLeft(null);
  }

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const active = secondsLeft !== null;
  const done = secondsLeft === 0;
  const progress = active && selectedDuration > 0 ? Math.max(0, secondsLeft / selectedDuration) : 0;

  return (
    <div
      className={`rounded-2xl border p-2 transition-colors ${
        active && !done ? "border-emerald-500/50 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <Timer className="ml-1 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        <span
          className={`w-[4.25rem] shrink-0 font-display text-3xl font-extrabold leading-none tabular-nums ${
            done ? "animate-pulse text-red-400" : active ? "text-emerald-400" : "text-zinc-600"
          }`}
        >
          {active ? formatTime(secondsLeft) : "0:00"}
        </span>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          {[60, 90, 120]
            .filter((d) => !active || d === selectedDuration)
            .map((duration) => (
              <button
                key={duration}
                type="button"
                onClick={() => startTimer(duration)}
                aria-label={`Start ${duration} second rest`}
                className={`min-h-[44px] min-w-[44px] flex-1 rounded-xl font-display text-lg font-bold transition-colors active:scale-95 ${
                  active && selectedDuration === duration
                    ? "bg-emerald-500 text-accent-ink"
                    : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                {duration}s
              </button>
            ))}

          {active && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={toggleRunning}
                aria-label={isRunning ? "Pause rest timer" : "Resume rest timer"}
                disabled={done}
              >
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={resetTimer}
                aria-label="Reset rest timer"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {active && (
        <div className="mx-1 mt-2 h-1 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
