"use client";

import { useRef, useState } from "react";

type SheetState = "peek" | "half" | "full";

/**
 * Bottom-sheet container for the right-panel on mobile (<md).
 * On desktop (md+) it renders as a normal in-flow column: no fixed
 * positioning, no drag handle, no rounded corners — matches the
 * original right-panel styling so desktop behavior is unchanged.
 */
export default function MobileSheet({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SheetState>("half");
  const touchStartY = useRef<number | null>(null);

  const cycleTap = () =>
    setState((s) => (s === "peek" ? "half" : s === "half" ? "full" : "peek"));

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start == null) {
      cycleTap();
      return;
    }
    const dy = e.changedTouches[0].clientY - start;
    if (Math.abs(dy) < 24) {
      cycleTap();
      return;
    }
    if (dy < 0) {
      // swipe up — bigger
      setState((s) => (s === "peek" ? "half" : "full"));
    } else {
      // swipe down — smaller
      setState((s) => (s === "full" ? "half" : "peek"));
    }
  };

  const heightClass =
    state === "peek"
      ? "h-[92px]"
      : state === "half"
      ? "h-[52vh]"
      : "h-[85vh]";

  return (
    <div
      className={[
        // Mobile: fixed bottom sheet overlaying the map
        "right-panel bg-white dark:bg-arc-gray-900 flex flex-col min-h-0",
        "fixed bottom-0 left-0 right-0 z-30",
        "rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.25)]",
        "transition-[height] duration-300 ease-out",
        heightClass,
        // Desktop: reset to in-flow column matching the original panel
        "md:static md:rounded-none md:shadow-none md:z-auto md:h-auto",
        "md:border-l md:border-arc-gray-100 dark:md:border-arc-gray-700",
      ].join(" ")}
      role="region"
      aria-label="Information panel"
    >
      {/* Drag/tap handle — mobile only */}
      <button
        type="button"
        onClick={(e) => {
          // Only handle click when it wasn't a touch gesture (touchEnd already cycled).
          if (touchStartY.current !== null) return;
          cycleTap();
          e.preventDefault();
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="md:hidden flex items-center justify-center shrink-0 py-2 active:bg-arc-gray-100 dark:active:bg-arc-gray-700 select-none touch-none"
        aria-label={
          state === "peek"
            ? "Expand panel"
            : state === "full"
            ? "Collapse panel"
            : "Resize panel"
        }
      >
        <span className="block w-12 h-1.5 rounded-full bg-arc-gray-300 dark:bg-arc-gray-700" />
      </button>
      {children}
    </div>
  );
}
