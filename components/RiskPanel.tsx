"use client";

import type { RiskFilter, RiskMode } from "./ControlPanel";

interface Props {
  risk: RiskFilter;
  onRiskChange: (v: RiskFilter) => void;
}

const MODES: { key: RiskMode; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "svi", label: "SVI" },
  { key: "nri", label: "NRI" },
  { key: "combined", label: "Combined" },
];

export default function RiskPanel({ risk, onRiskChange }: Props) {
  const rampLabel =
    risk.mode === "off"
      ? "No tract shading"
      : risk.mode === "svi"
      ? "Social Vulnerability Index"
      : risk.mode === "nri"
      ? "FEMA National Risk Index"
      : "Combined — tract must pass both thresholds";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="text-[10px] font-data uppercase tracking-widest text-arc-red mb-3">
        Tract Risk Overlay
      </div>
      <div className="flex gap-1 mb-3">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onRiskChange({ ...risk, mode: m.key })}
            className={`flex-1 text-[10px] font-data uppercase tracking-wider px-2 py-1.5 border transition-colors ${
              risk.mode === m.key
                ? "bg-arc-maroon text-white border-arc-maroon"
                : "bg-white dark:bg-arc-gray-900 text-arc-gray-900 dark:text-arc-cream border-arc-gray-300 dark:border-arc-gray-700 hover:border-arc-maroon"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-arc-gray-500 dark:text-arc-gray-300 mb-3 leading-snug">
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
      <div className="mt-4 pt-3 border-t border-arc-gray-100 dark:border-arc-gray-700 text-[10px] text-arc-gray-500 dark:text-arc-gray-300 leading-relaxed">
        Tracts are shaded by CDC Social Vulnerability Index (SVI) and/or FEMA
        National Risk Index (NRI). Click any tract on the map to see full
        vulnerability detail.
      </div>
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
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-data uppercase tracking-wider text-arc-gray-500 dark:text-arc-gray-300">
          {label}
        </span>
        <span className="text-[12px] font-data font-semibold" style={{ color: accent }}>
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
        className="w-full"
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
    <div className="flex items-center gap-0.5 mt-2">
      {stops.map((s) => (
        <div
          key={s.l}
          className="flex-1 text-[9px] text-center text-arc-gray-500 dark:text-arc-gray-300"
        >
          <div className="h-3 w-full rounded-sm" style={{ background: s.c }} />
          <div className="mt-0.5">{s.l}</div>
        </div>
      ))}
    </div>
  );
}
