"use client";

import { ASSET_TYPES, type AssetLayerVisibility, type AssetType } from "./MapView";
import { AssetIcon } from "./AssetIcons";

interface Props {
  visibility: AssetLayerVisibility;
  onVisibilityChange: (v: AssetLayerVisibility) => void;
}

export default function LayersPanel({ visibility, onVisibilityChange }: Props) {
  const toggleAsset = (k: AssetType) => {
    onVisibilityChange({ ...visibility, [k]: !visibility[k] });
  };
  const allOn = () => {
    const next: AssetLayerVisibility = { ...visibility };
    for (const { key } of ASSET_TYPES) next[key] = true;
    onVisibilityChange(next);
  };
  const allOff = () => {
    const next: AssetLayerVisibility = { ...visibility };
    for (const { key } of ASSET_TYPES) next[key] = false;
    onVisibilityChange(next);
  };

  const onCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-data uppercase tracking-widest text-arc-red">
          Operational Layers
        </div>
        <div className="flex gap-3">
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
      </div>
      <div className="space-y-1">
        {ASSET_TYPES.map(({ key, label, color }) => (
          <label
            key={key}
            className="flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-arc-cream dark:hover:bg-arc-black rounded"
          >
            <input
              type="checkbox"
              checked={visibility[key]}
              onChange={() => toggleAsset(key)}
              className="w-4 h-4 accent-arc-maroon"
            />
            <AssetIcon type={key} color={color} size={20} title={label} />
            <span className="text-sm text-arc-gray-900 dark:text-arc-cream">
              {label}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-arc-gray-100 dark:border-arc-gray-700 text-[10px] text-arc-gray-500 dark:text-arc-gray-300 leading-relaxed">
        {onCount}/{ASSET_TYPES.length} layers visible. Toggle map markers for
        Red Cross sites, hospitals, mobile home parks, schools, fire stations,
        and police stations.
      </div>
    </div>
  );
}
