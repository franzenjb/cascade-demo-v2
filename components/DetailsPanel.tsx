"use client";

import { useEffect, useState } from "react";
import TractPanel from "./TractPanel";
import RiskPanel from "./RiskPanel";
import LayersPanel from "./LayersPanel";
import type { TractPopupProps } from "@/lib/tract-popup";
import type { RiskFilter } from "@/lib/types";
import type { AssetLayerVisibility } from "./MapView";

interface Props {
  selectedTract: TractPopupProps | null;
  risk: RiskFilter;
  onRiskChange: (v: RiskFilter) => void;
  visibility: AssetLayerVisibility;
  onVisibilityChange: (v: AssetLayerVisibility) => void;
}

type Section = "tract" | "risk" | "layers";

export default function DetailsPanel({
  selectedTract,
  risk,
  onRiskChange,
  visibility,
  onVisibilityChange,
}: Props) {
  const [open, setOpen] = useState<Record<Section, boolean>>({
    tract: !!selectedTract,
    risk: false,
    layers: false,
  });

  // Auto-expand tract section when a tract is selected
  useEffect(() => {
    if (selectedTract) {
      setOpen((prev) => ({ ...prev, tract: true }));
    }
  }, [selectedTract]);

  const toggle = (s: Section) =>
    setOpen((prev) => ({ ...prev, [s]: !prev[s] }));

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Tract section */}
      <button
        onClick={() => toggle("tract")}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-data uppercase tracking-wider text-arc-black dark:text-arc-cream hover:bg-arc-cream/60 dark:hover:bg-arc-black/40 border-b border-arc-gray-100 dark:border-arc-gray-700"
      >
        <Chevron open={open.tract} />
        <span className="flex-1">
          {selectedTract
            ? selectedTract.place || `Tract ${selectedTract.name}`
            : "Selected Tract"}
        </span>
        {selectedTract && (
          <span className="text-[10px] font-normal text-arc-gray-500 normal-case tracking-normal">
            SVI {((selectedTract.svi_pct ?? 0) * 100).toFixed(0)}%
          </span>
        )}
      </button>
      {open.tract && (
        <div className="border-b border-arc-gray-100 dark:border-arc-gray-700">
          <TractPanel tract={selectedTract} />
        </div>
      )}

      {/* Risk overlay section */}
      <button
        onClick={() => toggle("risk")}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-data uppercase tracking-wider text-arc-black dark:text-arc-cream hover:bg-arc-cream/60 dark:hover:bg-arc-black/40 border-b border-arc-gray-100 dark:border-arc-gray-700"
      >
        <Chevron open={open.risk} />
        <span className="flex-1">Risk Overlay</span>
        <span className="text-[10px] font-normal text-arc-gray-500 normal-case tracking-normal">
          {risk.mode === "off"
            ? "off"
            : risk.mode === "combined"
            ? `SVI ≥ ${risk.sviMin} · NRI ≥ ${risk.nriMin}`
            : risk.mode === "svi"
            ? `SVI ≥ ${risk.sviMin}%`
            : `NRI ≥ ${risk.nriMin}`}
        </span>
      </button>
      {open.risk && (
        <div className="border-b border-arc-gray-100 dark:border-arc-gray-700">
          <RiskPanel risk={risk} onRiskChange={onRiskChange} />
        </div>
      )}

      {/* Map layers section */}
      <button
        onClick={() => toggle("layers")}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-data uppercase tracking-wider text-arc-black dark:text-arc-cream hover:bg-arc-cream/60 dark:hover:bg-arc-black/40 border-b border-arc-gray-100 dark:border-arc-gray-700"
      >
        <Chevron open={open.layers} />
        <span className="flex-1">Map Layers</span>
        <span className="text-[10px] font-normal text-arc-gray-500 normal-case tracking-normal">
          {Object.values(visibility).filter(Boolean).length}/
          {Object.keys(visibility).length} on
        </span>
      </button>
      {open.layers && (
        <LayersPanel
          visibility={visibility}
          onVisibilityChange={onVisibilityChange}
        />
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      className={`transition-transform text-arc-gray-500 ${open ? "rotate-90" : ""}`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M4 2 L8 6 L4 10 Z" />
    </svg>
  );
}
