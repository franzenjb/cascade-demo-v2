"use client";

import { useEffect, useRef, useState } from "react";
import { AssetIcon } from "./AssetIcons";
import { ASSET_TYPES, type AssetType } from "./MapView";
import { configFor, type DrillAsset } from "./DrillPanel";

interface Props {
  assetsByCategory: Partial<Record<AssetType, DrillAsset[]>>;
  footprintIdsByCategory?: Partial<Record<AssetType, Set<string>>>;
  onSelect?: (a: DrillAsset) => void;
  highlightId?: string | null;
  resetSignal?: number;
}

export default function AllAssetsAccordion({
  assetsByCategory,
  footprintIdsByCategory,
  onSelect,
  highlightId,
  resetSignal,
}: Props) {
  const [open, setOpen] = useState<Record<AssetType, boolean>>(() =>
    defaults(),
  );
  const highlightedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setOpen(defaults());
  }, [resetSignal]);

  useEffect(() => {
    if (!highlightId) return;
    for (const t of ASSET_TYPES) {
      const inThis = assetsByCategory[t.key]?.some((a) => a.id === highlightId);
      if (inThis && !open[t.key]) {
        setOpen((prev) => ({ ...prev, [t.key]: true }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  useEffect(() => {
    if (highlightId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [highlightId]);

  const toggle = (id: AssetType) =>
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex-1 overflow-y-auto">
      {ASSET_TYPES.map((section) => {
        const rows = assetsByCategory[section.key] ?? [];
        const isOpen = open[section.key];
        const cfg = configFor(section.key, rows);
        const footprintIds = footprintIdsByCategory?.[section.key];
        const footprintCount = footprintIds?.size ?? 0;
        return (
          <div
            key={section.key}
            className="border-b border-arc-gray-100 dark:border-arc-gray-700"
          >
            <button
              type="button"
              onClick={() => toggle(section.key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-arc-cream/40 dark:hover:bg-arc-black/40 transition-colors text-left"
              aria-expanded={isOpen}
            >
              <AssetIcon
                type={section.key}
                color={section.color}
                size={18}
                title={section.label}
              />
              <span className="text-sm font-semibold text-arc-black dark:text-arc-cream flex-1">
                {section.label}
              </span>
              {footprintCount > 0 && (
                <span
                  className="text-[10px] font-data uppercase tracking-wider px-1.5 py-0.5 bg-arc-red text-white"
                  title="In current warning footprint"
                >
                  {footprintCount} in footprint
                </span>
              )}
              <span
                className={`text-[11px] font-data px-1.5 py-0.5 ${
                  rows.length > 0
                    ? "bg-arc-black text-white dark:bg-arc-cream dark:text-arc-black"
                    : "bg-arc-cream dark:bg-arc-black text-arc-gray-500 dark:text-arc-gray-300"
                }`}
              >
                {rows.length}
              </span>
              <svg
                className={`w-3 h-3 text-arc-gray-500 dark:text-arc-gray-300 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden
              >
                <path d="M4 2 L8 6 L4 10 Z" />
              </svg>
            </button>

            {isOpen && (
              <div className="border-t border-arc-gray-100 dark:border-arc-gray-700">
                {rows.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-arc-gray-500 dark:text-arc-gray-300 italic">
                    No {section.label.toLowerCase()} in dataset.
                  </div>
                ) : (
                  <div className="divide-y divide-arc-gray-100 dark:divide-arc-gray-700">
                    {rows.map((a) => {
                      const isHighlighted = highlightId === a.id;
                      const inFootprint = footprintIds?.has(a.id) ?? false;
                      const clickable = Boolean(onSelect);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          ref={isHighlighted ? highlightedRef : undefined}
                          onClick={
                            clickable ? () => onSelect?.(a) : undefined
                          }
                          disabled={!clickable}
                          className={`w-full text-left p-3 text-xs transition-colors ${
                            isHighlighted
                              ? "bg-arc-red/10 ring-2 ring-arc-red ring-inset"
                              : clickable
                              ? "hover:bg-arc-cream/60 dark:hover:bg-arc-black/40 cursor-pointer"
                              : "cursor-default"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-sm text-arc-black dark:text-arc-cream">
                              {a.name || "Unnamed"}
                            </div>
                            {inFootprint && (
                              <span className="text-[9px] font-data uppercase tracking-wider px-1.5 py-0.5 bg-arc-red text-white flex-shrink-0">
                                In footprint
                              </span>
                            )}
                          </div>
                          <div className="text-arc-gray-500 dark:text-arc-gray-300 mt-0.5">
                            {a.address}, {a.city}
                          </div>
                          {cfg.renderTags(a.attrs)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function defaults(): Record<AssetType, boolean> {
  return Object.fromEntries(ASSET_TYPES.map((t) => [t.key, true])) as Record<
    AssetType,
    boolean
  >;
}
