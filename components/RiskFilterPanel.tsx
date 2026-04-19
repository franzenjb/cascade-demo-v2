"use client";

import { useState } from "react";

export type RiskMode = "off" | "svi" | "nri" | "combined";

export interface RiskFilter {
  mode: RiskMode;
  sviMin: number; // 0..100 percentile
  nriMin: number; // 0..100 score
}

interface Props {
  value: RiskFilter;
  onChange: (v: RiskFilter) => void;
}

const MODES: { key: RiskMode; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "svi", label: "SVI" },
  { key: "nri", label: "NRI" },
  { key: "combined", label: "Combined" },
];

export default function RiskFilterPanel({ value, onChange }: Props) {
  const [open, setOpen] = useState(true);

  const rampLabel =
    value.mode === "off"
      ? "No tract shading"
      : value.mode === "svi"
      ? "Social Vulnerability Index"
      : value.mode === "nri"
      ? "FEMA National Risk Index"
      : "Combined (avg of SVI + NRI)";

  const minValue =
    value.mode === "svi"
      ? value.sviMin
      : value.mode === "nri"
      ? value.nriMin
      : value.mode === "combined"
      ? Math.max(value.sviMin, value.nriMin)
      : 0;

  return (
    <div className="absolute top-[56px] left-3 z-20 bg-white/95 dark:bg-arc-gray-900/95 backdrop-blur rounded-md shadow-lg border border-arc-gray-300 dark:border-arc-gray-700 min-w-[260px] max-w-[320px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-data uppercase tracking-wider text-arc-black dark:text-arc-cream hover:bg-arc-cream/60 dark:hover:bg-arc-black/40"
      >
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-arc-red" />
        <span className="flex-1">Tract Risk</span>
        <span className="text-[10px] font-normal text-arc-gray-500">
          {value.mode === "off" ? "off" : `≥ ${minValue}%`}
        </span>
        <svg
          viewBox="0 0 12 12"
          width="10"
          height="10"
          className={`transition-transform text-arc-gray-500 ${
            open ? "rotate-90" : ""
          }`}
          fill="currentColor"
          aria-hidden
        >
          <path d="M4 2 L8 6 L4 10 Z" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-arc-gray-100 dark:border-arc-gray-700">
          <div className="flex gap-1 mb-3">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => onChange({ ...value, mode: m.key })}
                className={`flex-1 text-[10px] font-data uppercase tracking-wider px-2 py-1 border transition-colors ${
                  value.mode === m.key
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

          {(value.mode === "svi" || value.mode === "combined") && (
            <Slider
              label="SVI percentile ≥"
              value={value.sviMin}
              onChange={(v) => onChange({ ...value, sviMin: v })}
              accent="#a51c30"
            />
          )}
          {(value.mode === "nri" || value.mode === "combined") && (
            <Slider
              label="NRI score ≥"
              value={value.nriMin}
              onChange={(v) => onChange({ ...value, nriMin: v })}
              accent="#5b2b8c"
            />
          )}

          {value.mode !== "off" && (
            <Legend mode={value.mode} />
          )}
        </div>
      )}
    </div>
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
        <span
          className="text-[11px] font-data font-semibold"
          style={{ color: accent }}
        >
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
