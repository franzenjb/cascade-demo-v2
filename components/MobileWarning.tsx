"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "cascade-v2-mobile-warning-dismissed";

export default function MobileWarning() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DISMISS_KEY);
      if (stored === "1") return;
    } catch {}
    setDismissed(false);
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="md:hidden fixed inset-0 z-[9999] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-warning-title"
    >
      {/* Compact header */}
      <div className="shrink-0 px-4 py-2 flex items-baseline justify-between gap-3 border-b border-white/10">
        <h2 id="mobile-warning-title" className="text-base font-bold leading-none">
          Cascade 2
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Desktop app · preview
        </span>
      </div>

      {/* Video at its natural 16:9 aspect + descriptive copy below */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="w-full aspect-video bg-black">
          <video
            src="/cascade2-demo.mp4"
            autoPlay
            muted
            loop
            playsInline
            controls
            className="w-full h-full object-contain"
          />
        </div>
        <div className="px-4 py-5 flex flex-col gap-4 text-white/90">
          <p className="text-base font-medium leading-snug">
            Cascade 2 is a conversational emergency-management map for{" "}
            <span className="font-bold text-white">Pinellas County, FL</span>.
            When a tornado or hurricane warning fires, it draws the warning
            polygon, counts schools, hospitals, Red Cross sites and mobile-home
            parks inside, and generates a situational briefing — in seconds.
          </p>
          <p className="text-sm font-medium leading-snug text-white/75">
            Built on real public data: CDC SVI, FEMA NRI, ALICE, OpenFEMA,
            TIGERweb, Florida parcels.
          </p>
        </div>
      </div>

      {/* Compact footer — URL + CTA inline */}
      <div className="shrink-0 px-3 py-3 border-t border-white/10 flex items-center gap-3">
        <span className="text-xs font-medium text-white/80 leading-tight flex-1">
          Open on laptop:
          <br />
          <span className="font-bold text-white text-sm">cascade2.jbf.com</span>
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md bg-white text-black font-bold text-sm py-2.5 px-4 active:bg-white/80"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
