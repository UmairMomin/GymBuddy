"use client";

import * as React from "react";

/**
 * Runs while the HTML is parsed: if this tab session has already shown the splash, hide it before first paint.
 * (sessionStorage resets when the app is closed and reopened, so a fresh launch plays it again.)
 */
export function SplashScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `try{if(sessionStorage.getItem("gb-splash"))document.documentElement.setAttribute("data-splash","off")}catch(e){}`,
      }}
    />
  );
}

/**
 * Startup animation: plates slide onto the bar one pair at a time, two reps, then the wordmark. It is plain
 * CSS (starts with the server-rendered HTML, fades itself out after about 2.6s), so it needs no JS to leave.
 */
export function AppSplash() {
  React.useEffect(() => {
    try {
      sessionStorage.setItem("gb-splash", "1");
    } catch {
      /* private mode: the splash simply plays on every load */
    }
  }, []);

  return (
    <div aria-hidden className="gb-splash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-zinc-950">
      <svg viewBox="0 0 200 72" width={220} height={79} className="overflow-visible">
        <g className="gb-sp-lift">
          <rect className="gb-bar gb-sp-bar" x="0" y="34" width="200" height="5" rx="2.5" />
          <rect className="gb-sleeve gb-sp-bar" x="0" y="31" width="60" height="11" rx="2" />
          <rect className="gb-sleeve gb-sp-bar" x="140" y="31" width="60" height="11" rx="2" />
          <g className="gb-sp-l gb-sp-d1"><rect className="gb-p1" x="36" y="6" width="12" height="60" rx="3" /></g>
          <g className="gb-sp-r gb-sp-d1"><rect className="gb-p1" x="152" y="6" width="12" height="60" rx="3" /></g>
          <g className="gb-sp-l gb-sp-d2"><rect className="gb-p2" x="25" y="14" width="10" height="44" rx="3" /></g>
          <g className="gb-sp-r gb-sp-d2"><rect className="gb-p2" x="165" y="14" width="10" height="44" rx="3" /></g>
          <g className="gb-sp-l gb-sp-d3">
            <rect className="gb-p3" x="16" y="22" width="8" height="28" rx="2" />
            <rect className="gb-collar" x="10" y="28" width="4" height="16" rx="1" />
          </g>
          <g className="gb-sp-r gb-sp-d3">
            <rect className="gb-p3" x="176" y="22" width="8" height="28" rx="2" />
            <rect className="gb-collar" x="186" y="28" width="4" height="16" rx="1" />
          </g>
        </g>
      </svg>
      <div className="gb-sp-word font-display text-5xl font-extrabold uppercase leading-none tracking-wide">
        Gym<span className="text-emerald-400">Buddy</span>
      </div>
    </div>
  );
}
