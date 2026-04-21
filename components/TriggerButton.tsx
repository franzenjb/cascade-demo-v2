"use client";

import { useState } from "react";

interface TriggerFiredPayload {
  directive: string;
  polygon: unknown;
  scenarioId: string;
  focusCenter: [number, number];
  focusZoom: number;
  nwsEventId: string;
  expires: string;
}

interface TriggerButtonProps {
  onFired: (p: TriggerFiredPayload) => void;
}

export default function TriggerButton({ onFired }: TriggerButtonProps) {
  const [loading, setLoading] = useState(false);
  const [fired, setFired] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  async function runSimulation() {
    if (loading) return;
    setShowIntro(false);
    setLoading(true);
    try {
      const scenarioId = "tornado_pinellas_replay";
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      const data = await res.json();
      if (data.success && data.trigger_directive) {
        onFired({
          directive: data.trigger_directive,
          polygon: data.polygon,
          scenarioId: data.scenario_id || scenarioId,
          focusCenter: data.focus_center,
          focusZoom: data.focus_zoom,
          nwsEventId: data.nws_event_id,
          expires: data.expires,
        });
        setFired(true);
        setTimeout(() => setFired(false), 3000);
      } else {
        console.error("Trigger failed:", data);
      }
    } catch (err) {
      console.error("Trigger error:", err);
    } finally {
      setLoading(false);
    }
  }

  const buttonLabel = loading
    ? "Simulating…"
    : fired
    ? "Warning Active"
    : "Simulate NWS Tornado Alert — Pinellas";

  return (
    <>
      <button
        onClick={() => setShowIntro(true)}
        disabled={loading}
        className={`px-4 py-2 text-xs font-semibold border-2 border-arc-red text-arc-red hover:bg-arc-red hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          fired ? "bg-arc-red text-white" : "bg-white dark:bg-arc-gray-900"
        }`}
      >
        {buttonLabel}
      </button>

      {showIntro && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 px-4"
          onClick={() => setShowIntro(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowIntro(false)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div
            className="bg-white dark:bg-arc-gray-900 border-2 border-arc-red max-w-lg w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-data uppercase tracking-widest text-arc-red mb-2">
              Cascade V2 · Simulation
            </div>
            <h3 className="font-headline text-xl font-bold text-arc-black dark:text-arc-cream mb-3 leading-tight">
              Simulate NWS Tornado Alert — Pinellas County
            </h3>
            <p className="text-sm text-arc-gray-900 dark:text-arc-cream leading-relaxed mb-4">
              This is what would occur if a National Weather Service tornado
              warning were actually issued for central Pinellas County. A
              webhook would fire this application — the warning polygon would
              draw on the map, and the briefing would be generated against
              real CDC SVI, FEMA NRI, ALICE, and Florida parcel data before
              anyone opened the app.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowIntro(false)}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border border-arc-gray-300 dark:border-arc-gray-700 text-arc-gray-900 dark:text-arc-cream hover:bg-arc-cream dark:hover:bg-arc-black transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={runSimulation}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-2 border-arc-red bg-arc-red text-white hover:bg-arc-red/90 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
