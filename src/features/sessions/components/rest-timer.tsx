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

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-xs">
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-emerald-400" />
        <span className="font-semibold text-zinc-200">Rest Timer:</span>
        {secondsLeft !== null ? (
          <span
            className={`font-mono text-sm font-bold ${
              secondsLeft === 0
                ? "text-red-400 animate-bounce"
                : "text-emerald-400"
            }`}
          >
            {formatTime(secondsLeft)}
          </span>
        ) : (
          <span className="text-zinc-500 italic">Off</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {[60, 90, 120].map((duration) => (
          <button
            key={duration}
            type="button"
            onClick={() => startTimer(duration)}
            className={`rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
              secondsLeft !== null && selectedDuration === duration
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {duration}s
          </button>
        ))}

        {secondsLeft !== null && (
          <div className="flex items-center gap-1 ml-1 pl-1 border-l border-zinc-700">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleRunning}
              className="h-7 w-7 text-zinc-300 hover:text-white"
            >
              {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={resetTimer}
              className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
