"use client";

import { useEffect, useRef, useState } from "react";
import { ASSET_TYPES, type AssetLayerVisibility, type AssetType } from "./MapView";
import { AssetIcon } from "./AssetIcons";

export type RiskMode = "off" | "svi" | "nri" | "combined";

export interface RiskFilter {
  mode: RiskMode;
  sviMin: number;
  nriMin: number;
}

interface Props {
  risk: RiskFilter;
  onRiskChange: (v: RiskFilter) => void;
  visibility: AssetLayerVisibility;
  onVisibilityChange: (v: AssetLayerVisibility) => void;
}

const MODES: { key: RiskMode; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "svi", label: "SVI" },
  { key: "nri", label: "NRI" },
  { key: "combined", label: "Combined" },
];

const STORAGE_KEY = "cascade-v2-control-panel-pos";
const DEFAULT_POS = { x: 12, y: 12 };

export default function ControlPanel({
  risk,
  onRiskChange,
  visibility,
  onVisibilityChange,
}: Props) {
  const [pos, setPos] = useState<{ x: number; y: number }>(DEFAULT_POS);
  const [riskOpen, setRiskOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setPos(parsed);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragState.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || !panelRef.current) return;
    const parent = panelRef.current.parentElement;
    if (!parent) return;
    const pRect = parent.getBoundingClientRect();
    const panelW = panelRef.current.offsetWidth;
    const panelH = panelRef.current.offsetHeight;
    let nx = e.clientX - dragState.current.dx - pRect.left;
    let ny = e.clientY - dragState.current.dy - pRect.top;
    nx = Math.max(0, Math.min(pRect.width - panelW, nx));
    ny = Math.max(0, Math.min(pRect.height - panelH, ny));
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    dragState.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {}
  };

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

  const rampLabel =
    risk.mode === "off"
      ? "No tract shading"
      : risk.mode === "svi"
      ? "Social Vulnerability Index"
      : risk.mode === "nri"
      ? "FEMA National Risk Index"
      : "Combined — tract must pass both thresholds";

  const riskSummary =
    risk.mode === "off"
      ? "off"
      : risk.mode === "svi"
      ? `SVI ≥ ${risk.sviMin}%`
      : risk.mode === "nri"
      ? `NRI ≥ ${risk.nriMin}`
      : `SVI ≥ ${risk.sviMin} · NRI ≥ ${risk.nriMin}`;

  const layersOnCount = Object.values(visibility).filter(Boolean).length;
  const layersSummary = `${layersOnCount}/${ASSET_TYPES.length} on`;

  if (!hydrated) return null;

  return (
    <div
      ref={panelRef}
      className="absolute z-20 bg-white/95 dark:bg-arc-gray-900/95 backdrop-blur rounded-md shadow-lg border border-arc-gray-300 dark:border-arc-gray-700 w-[280px] font-body"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex items-center gap-2 px-3 py-2 bg-arc-maroon text-white rounded-t-md cursor-grab active:cursor-grabbing select-none touch-none"
        title="Drag to move"
      >
        <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor" className="opacity-70" aria-hidden>
          <circle cx="3" cy="3" r="1" />
          <circle cx="9" cy="3" r="1" />
          <circle cx="3" cy="6" r="1" />
          <circle cx="9" cy="6" r="1" />
          <circle cx="3" cy="9" r="1" />
          <circle cx="9" cy="9" r="1" />
        </svg>
        <span className="flex-1 font-data uppercase tracking-wider text-[10px]">
          Controls
        </span>
        <span className="text-[9px] opacity-70 font-data uppercase tracking-wider">drag</span>
      </div>

      <button
        onClick={() => setRiskOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-data uppercase tracking-wider text-arc-black dark:text-arc-cream hover:bg-arc-cream/60 dark:hover:bg-arc-black/40 border-b border-arc-gray-100 dark:border-arc-gray-700"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-arc-red" />
        <span className="flex-1">Tract Risk</span>
        <span className="text-[10px] font-normal text-arc-gray-500 normal-case tracking-normal">
          {riskSummary}
        </span>
        <Chevron open={riskOpen} />
      </button>
      {riskOpen && (
        <div className="px-3 pb-3 pt-1 border-b border-arc-gray-100 dark:border-arc-gray-700">
          <div className="flex gap-1 mb-3">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => onRiskChange({ ...risk, mode: m.key })}
                className={`flex-1 text-[10px] font-data uppercase tracking-wider px-2 py-1 border transition-colors ${
                  risk.mode === m.key
                    ? "bg-arc-maroon text-white border-arc-maroon"
                    : "bg-white dark:bg-arc-gray-900 text-arc-gray-900 dark:text-arc-cream border-arc-gray-300 dark:border-arc-gray-700 hover:border-arc-maroon"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-arc-gray-500 dark:text-arc-gray-300 mb-2 leading-snug">
            {rampLabel}
          </div>
          {(risk.mode === "svi" || risk.mode === "combined") && (
            <Slider
              label="SVI percentile ≥"
              value={risk.sviMin}
              onChange={(v) => onRiskChange({ ...risk, sviMin: v })}
              accent="#a51c30"
            />
          )}
          {(risk.mode === "nri" || risk.mode === "combined") && (
            <Slider
              label="NRI score ≥"
              value={risk.nriMin}
              onChange={(v) => onRiskChange({ ...risk, nriMin: v })}
              accent="#5b2b8c"
            />
          )}
          {risk.mode !== "off" && <Legend mode={risk.mode} />}
        </div>
      )}

      <button
        onClick={() => setLayersOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-data uppercase tracking-wider text-arc-black dark:text-arc-cream hover:bg-arc-cream/60 dark:hover:bg-arc-black/40 ${layersOpen ? "" : "rounded-b-md"}`}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-arc-maroon" />
        <span className="flex-1">Operational Layers</span>
        <span className="text-[10px] font-normal text-arc-gray-500 normal-case tracking-normal">
          {layersSummary}
        </span>
        <Chevron open={layersOpen} />
      </button>
      {layersOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-arc-gray-100 dark:border-arc-gray-700 rounded-b-md">
          <div className="flex gap-2 pb-2 mb-1 border-b border-arc-gray-100 dark:border-arc-gray-700">
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
          <div className="space-y-1">
            {ASSET_TYPES.map(({ key, label, color }) => (
              <label
                key={key}
                className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-arc-cream dark:hover:bg-arc-black rounded-sm"
              >
                <input
                  type="checkbox"
                  checked={visibility[key]}
                  onChange={() => toggleAsset(key)}
                  className="w-3.5 h-3.5 accent-arc-maroon"
                />
                <AssetIcon type={key} color={color} size={18} title={label} />
                <span className="text-[11px] text-arc-gray-900 dark:text-arc-cream">
                  {label}
                </span>
              </label>
            ))}
          </div>
          <div className="pt-2 mt-2 border-t border-arc-gray-100 dark:border-arc-gray-700 text-[9px] text-arc-gray-500 leading-snug font-data">
            Synthetic-over-real Pinellas assets. Click any marker for details.
          </div>
        </div>
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

function Slider({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-data uppercase tracking-wider text-arc-gray-500 dark:text-arc-gray-300">
          {label}
        </span>
        <span className="text-[11px] font-data font-semibold" style={{ color: accent }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-arc-red"
        style={{ accentColor: accent }}
      />
    </div>
  );
}

function Legend({ mode }: { mode: RiskMode }) {
  const stops =
    mode === "nri"
      ? [
          { c: "#f5e8c6", l: "0–20" },
          { c: "#e9c46a", l: "20–40" },
          { c: "#e07a3c", l: "40–60" },
          { c: "#c0392b", l: "60–80" },
          { c: "#5b2b8c", l: "80+" },
        ]
      : [
          { c: "#f3e6e6", l: "0–25%" },
          { c: "#e9b7b7", l: "25–50%" },
          { c: "#d97373", l: "50–75%" },
          { c: "#b51a2b", l: "75–90%" },
          { c: "#7a0f1d", l: "90+%" },
        ];
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {stops.map((s) => (
        <div
          key={s.l}
          className="flex-1 text-[9px] text-center text-arc-gray-500 dark:text-arc-gray-300"
        >
          <div className="h-2 w-full" style={{ background: s.c }} />
          <div className="mt-0.5">{s.l}</div>
        </div>
      ))}
    </div>
  );
}
