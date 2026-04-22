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
      className="md:hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-warning-title"
    >
      <div className="max-w-sm w-full rounded-lg bg-white text-slate-900 shadow-2xl p-5 border-2 border-slate-900">
        <h2
          id="mobile-warning-title"
          className="text-xl font-bold mb-3"
        >
          Desktop app
        </h2>
        <p className="text-base font-medium leading-snug mb-4">
          Cascade 2 is designed for desktop or tablet. A mobile version is in
          progress. Some panels may overlap or be hard to use on this screen.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="w-full rounded-md bg-slate-900 text-white font-bold text-base py-3 px-4 active:bg-slate-700"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}
