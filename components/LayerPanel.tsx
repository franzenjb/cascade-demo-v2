"use client";

import { useState } from "react";
import { ASSET_TYPES, type AssetLayerVisibility, type AssetType } from "./MapView";
import { AssetIcon } from "./AssetIcons";

interface Props {
  visibility: AssetLayerVisibility;
  onChange: (v: AssetLayerVisibility) => void;
}

export default function LayerPanel({ visibility, onChange }: Props) {
  const [open, setOpen] = useState(true);

  const toggle = (k: AssetType) => {
    onChange({ ...visibility, [k]: !visibility[k] });
  };

  const allOn = () => {
    const next: AssetLayerVisibility = { ...visibility };
    for (const { key } of ASSET_TYPES) next[key] = true;
    onChange(next);
  };
  const allOff = () => {
    const next: AssetLayerVisibility = { ...visibility };
    for (const { key } of ASSET_TYPES) next[key] = false;
    onChange(next);
  };

  return (
    <div className="absolute top-3 left-3 z-10 bg-white/95 dark:bg-arc-gray-900/95 border border-arc-gray-100 dark:border-arc-gray-700 shadow-md backdrop-blur-sm max-w-[240px] font-body text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border-b border-arc-gray-100 dark:border-arc-gray-700 bg-arc-maroon text-white hover:bg-arc-maroon-dark transition-colors"
      >
        <span className="font-data uppercase tracking-wider text-[10px]">
          Operational Layers
        </span>
        <span className="text-sm leading-none">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="p-2 space-y-1">
          <div className="flex gap-2 pb-2 border-b border-arc-gray-100 dark:border-arc-gray-700">
            <button
              onClick={allOn}
              className="text-[10px] font-data uppercase tracking-wider text-arc-maroon hover:underline"
            >
              All on
            </button>
            <button
              onClick={allOff}
              className="text-[10px] font-data uppercase tracking-wider text-arc-gray-500 hover:underline"
            >
              All off
            </button>
          </div>
          {ASSET_TYPES.map(({ key, label, color }) => (
            <label
              key={key}
              className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-arc-cream dark:hover:bg-arc-black rounded-sm"
            >
              <input
                type="checkbox"
                checked={visibility[key]}
                onChange={() => toggle(key)}
                className="w-3.5 h-3.5 accent-arc-maroon"
              />
              <AssetIcon type={key} color={color} size={18} title={label} />
              <span className="text-[11px] text-arc-gray-900 dark:text-arc-cream">
                {label}
              </span>
            </label>
          ))}
          <div className="pt-2 mt-1 border-t border-arc-gray-100 dark:border-arc-gray-700 text-[9px] text-arc-gray-500 leading-snug font-data">
            Synthetic-over-real Pinellas assets. Click any marker for details.
          </div>
        </div>
      )}
    </div>
  );
}
