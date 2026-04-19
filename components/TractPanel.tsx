"use client";

import { useEffect, useState } from "react";
import type { TractPopupProps } from "@/lib/tract-popup";

interface ParcelStats {
  total_parcels?: number;
  residential?: number;
  commercial?: number;
  avg_assessed?: string | number;
  median_assessed?: number;
  total_assessed?: string | number;
  avg_market?: string | number;
  total_market?: string | number;
  avg_year_built?: string | number;
  pre_1950?: number;
  pre_1970?: number;
  post_2000?: number;
  avg_sqft?: string | number;
  avg_acres?: string | number;
  total_acres?: string | number;
  under_50k?: number;
  over_500k?: number;
  over_1m?: number;
}

interface Props {
  tract: TractPopupProps | null;
}

function bandForPct(pct: number): string {
  if (pct >= 90) return "#7a0f1d";
  if (pct >= 75) return "#b51a2b";
  if (pct >= 50) return "#d97373";
  if (pct >= 25) return "#e9b7b7";
  return "#f3e6e6";
}

function bandForScore(score: number): string {
  if (score >= 80) return "#5b2b8c";
  if (score >= 60) return "#c0392b";
  if (score >= 40) return "#e07a3c";
  if (score >= 20) return "#e9c46a";
  return "#f5e8c6";
}

function fmtInt(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString();
}

function fmtMoney(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

export default function TractPanel({ tract }: Props) {
  const [stats, setStats] = useState<ParcelStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (!tract) {
      setStats(null);
      setStatsError(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);
    setStats(null);
    const url = `/api/parcels/stats?xmin=${tract.xmin}&ymin=${tract.ymin}&xmax=${tract.xmax}&ymax=${tract.ymax}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: ParcelStats) => {
        if (!cancelled) setStats(data);
      })
      .catch((e) => {
        if (!cancelled) setStatsError(e.message || "parcel fetch failed");
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tract]);

  if (!tract) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-[260px]">
          <div className="text-xs font-data uppercase tracking-wider text-arc-gray-500 mb-2">
            No tract selected
          </div>
          <p className="text-sm text-arc-gray-500 dark:text-arc-gray-300 leading-relaxed">
            Click any shaded tract on the map (or the{" "}
            <span className="font-semibold text-arc-maroon dark:text-arc-red">
              Most vulnerable area
            </span>{" "}
            metric) to load SVI sub-themes, NRI hazards, and parcel statistics.
          </p>
        </div>
      </div>
    );
  }

  const sviPct = tract.svi_pct != null ? Math.round(tract.svi_pct * 100) : null;
  const combined =
    tract.combined_pct ??
    sviPct ??
    (tract.nri_score != null ? Math.round(tract.nri_score) : null);
  const heroColor = combined != null ? bandForPct(combined) : "#6b7280";

  const hazards: { label: string; val: number | null }[] = [
    { label: "Hurricane", val: tract.nri_hrcn },
    { label: "Coastal flood", val: tract.nri_cfld },
    { label: "Riverine flood", val: tract.nri_ifld },
    { label: "Tornado", val: tract.nri_trnd },
    { label: "Wildfire", val: tract.nri_wfir },
    { label: "Heat wave", val: tract.nri_hwav },
  ];
  const topHazards = hazards
    .filter((h) => h.val != null && (h.val as number) > 0)
    .sort((a, b) => (b.val as number) - (a.val as number))
    .slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto p-4 text-sm text-arc-gray-900 dark:text-arc-cream">
      {/* Hero */}
      <div
        className="rounded-md p-3 text-white flex items-center justify-between gap-3"
        style={{
          background: `linear-gradient(135deg, ${heroColor} 0%, #5b2b8c 130%)`,
        }}
      >
        <div>
          <div className="font-headline font-bold text-base leading-tight">
            {tract.place || "Pinellas County"}
          </div>
          <div className="text-[10px] font-data uppercase tracking-widest text-white/80 mt-0.5">
            Tract {tract.name} · GEOID {tract.geoid}
          </div>
        </div>
        <div className="text-right leading-none">
          <div className="font-headline font-bold text-3xl">
            {combined != null ? combined : "—"}
          </div>
          <div className="text-[9px] font-data uppercase tracking-widest text-white/80 mt-1">
            Combined
          </div>
        </div>
      </div>

      {/* Population */}
      <Subhead>Population &amp; risk</Subhead>
      <KV k="Total population" v={fmtInt(tract.pop)} />
      <KV
        k="SVI percentile"
        v={sviPct != null ? `${sviPct}%` : "—"}
        accent="#a51c30"
      />
      <KV
        k="NRI risk score"
        v={tract.nri_score != null ? tract.nri_score.toFixed(1) : "—"}
        accent="#5b2b8c"
      />

      {/* SVI sub-themes */}
      <Subhead>SVI sub-themes</Subhead>
      <Bar label="Socioeconomic" val01={tract.svi_theme1} color="#a51c30" />
      <Bar label="Household comp." val01={tract.svi_theme2} color="#a51c30" />
      <Bar label="Minority status" val01={tract.svi_theme3} color="#a51c30" />
      <Bar label="Housing / transport" val01={tract.svi_theme4} color="#a51c30" />

      {/* Hazards */}
      {topHazards.length > 0 && (
        <>
          <Subhead>Top hazards (NRI)</Subhead>
          {topHazards.map((h) => (
            <ScoreBar key={h.label} label={h.label} val={h.val} />
          ))}
        </>
      )}

      {/* Parcels */}
      <Subhead>Parcels in tract</Subhead>
      {statsLoading && (
        <div className="text-xs text-arc-gray-500 dark:text-arc-gray-300 italic py-2">
          Loading parcel data…
        </div>
      )}
      {statsError && !statsLoading && (
        <div className="text-xs text-arc-red py-2">
          Could not load parcels: {statsError}
        </div>
      )}
      {stats && !statsLoading && (
        <>
          <div className="grid grid-cols-2 gap-2 my-2">
            <StatCard
              label="Parcels"
              value={fmtInt(stats.total_parcels)}
              sub={
                stats.residential != null && stats.commercial != null
                  ? `${fmtInt(stats.residential)} res · ${fmtInt(stats.commercial)} com`
                  : undefined
              }
            />
            <StatCard
              label="Total value"
              value={fmtMoney(stats.total_assessed)}
              sub={
                stats.avg_assessed
                  ? `avg ${fmtMoney(stats.avg_assessed)}`
                  : undefined
              }
            />
            <StatCard
              label="Median value"
              value={fmtMoney(stats.median_assessed)}
              sub={
                stats.over_500k != null
                  ? `${fmtInt(stats.over_500k)} ≥ $500K`
                  : undefined
              }
            />
            <StatCard
              label="Avg year built"
              value={fmtInt(stats.avg_year_built)}
              sub={
                stats.pre_1970 != null
                  ? `${fmtInt(stats.pre_1970)} pre-1970`
                  : undefined
              }
            />
          </div>
          {(stats.total_acres != null || stats.avg_sqft != null) && (
            <div className="text-[11px] font-data text-arc-gray-500 dark:text-arc-gray-300 mb-2">
              {stats.total_acres != null && (
                <span>
                  Total acres: {fmtInt(stats.total_acres)}
                </span>
              )}
              {stats.avg_sqft != null && (
                <span className="ml-3">
                  Avg sqft: {fmtInt(stats.avg_sqft)}
                </span>
              )}
            </div>
          )}
        </>
      )}

      <div className="text-[10px] text-arc-gray-500 dark:text-arc-gray-300 italic mt-3 pt-3 border-t border-arc-gray-100 dark:border-arc-gray-700">
        CDC SVI 2022 · FEMA NRI 2023 · Florida DOR parcels
      </div>
    </div>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-arc-gray-300 mt-4 mb-2 pb-1 border-b border-arc-gray-100 dark:border-arc-gray-700">
      {children}
    </div>
  );
}

function KV({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between text-[12px] py-1">
      <span className="text-arc-gray-500 dark:text-arc-gray-300">{k}</span>
      <span
        className="font-data font-semibold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {v}
      </span>
    </div>
  );
}

function Bar({
  label,
  val01,
  color,
}: {
  label: string;
  val01: number | null;
  color: string;
}) {
  const pct =
    val01 != null ? Math.max(0, Math.min(100, Math.round(val01 * 100))) : null;
  return (
    <div className="my-1.5">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-arc-gray-500 dark:text-arc-gray-300">{label}</span>
        <span className="font-data font-semibold tabular-nums">
          {pct != null ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 bg-arc-gray-100 dark:bg-arc-gray-700 rounded-full overflow-hidden">
        {pct != null && (
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        )}
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  val,
}: {
  label: string;
  val: number | null;
}) {
  if (val == null) return null;
  const v = Math.max(0, Math.min(100, Number(val)));
  const color = bandForScore(v);
  return (
    <div className="my-1.5">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-arc-gray-500 dark:text-arc-gray-300">{label}</span>
        <span className="font-data font-semibold tabular-nums">
          {v.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 bg-arc-gray-100 dark:bg-arc-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${v}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-arc-gray-100 dark:border-arc-gray-700 rounded px-2 py-1.5 bg-arc-cream/40 dark:bg-arc-black/30">
      <div className="text-[9px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-arc-gray-300">
        {label}
      </div>
      <div className="font-headline font-bold text-base leading-tight text-arc-black dark:text-arc-cream">
        {value}
      </div>
      {sub && (
        <div className="text-[10px] font-data text-arc-gray-500 dark:text-arc-gray-300">
          {sub}
        </div>
      )}
    </div>
  );
}
