"use client";

import type { DrillAsset } from "./DrillPanel";
import type { AssetType } from "./MapView";
import { STORM_REPORTS } from "@/lib/storm-reports";

interface TractHit {
  geoid: string;
  name: string;
  pop: number;
  rpl_themes: number | null;
}

interface SituationMetrics {
  popInFootprint: number | null;
  tractCount: number | null;
  topVulnCount: number | null;
  topTract: TractHit | null;
  totalAssets: number | null;
  aliceStruggling: number | null;
}

interface Props {
  metrics: SituationMetrics;
  countdown: string | null;
  footprintByCategory: Partial<Record<AssetType, DrillAsset[]>>;
  topTracts: TractHit[];
  onTractClick?: (nameOrGeoid: string) => void;
  stormReportCount: number;
  stormComplete?: boolean;
  onRestart?: () => void;
}

function shortTractName(raw: string) {
  return raw.replace(/^Census Tract\s+/i, "");
}

export default function BriefingCard({
  metrics,
  countdown,
  footprintByCategory,
  topTracts,
  onTractClick,
  stormReportCount,
  stormComplete,
  onRestart,
}: Props) {
  const mhps = footprintByCategory.mobile_home_park ?? [];
  const schools = footprintByCategory.school ?? [];
  const hospitals = footprintByCategory.hospital ?? [];
  const rcSites = footprintByCategory.red_cross ?? [];
  const fireStations = footprintByCategory.fire_station ?? [];
  const policeStations = footprintByCategory.police_station ?? [];

  const totalMhpUnits = mhps.reduce((s, a) => s + (Number(a.attrs?.units) || 0), 0);
  const totalEnrollment = schools.reduce((s, a) => s + (Number(a.attrs?.enrollment) || 0), 0);
  const totalBeds = hospitals.reduce((s, a) => s + (Number(a.attrs?.beds) || 0), 0);
  const totalErvs = rcSites.reduce((s, a) => s + (Number(a.attrs?.erv_count) || 0), 0);

  const pop = metrics.popInFootprint;
  const alicePct = metrics.aliceStruggling;
  const aliceAbsolute =
    pop != null && alicePct != null ? Math.round((alicePct / 100) * pop) : null;

  // Visible storm reports — newest first
  const visibleReports = STORM_REPORTS.slice(0, stormReportCount).reverse();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-arc-gray-900">
      {/* Compact KPI bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-arc-gray-100 dark:border-arc-gray-700 bg-arc-cream/40 dark:bg-arc-black/40 flex-shrink-0">
        <CompactKPI value={pop != null ? pop.toLocaleString() : "—"} label="At Risk" highlight />
        <span className="w-px h-5 bg-arc-gray-300 dark:bg-arc-gray-700 flex-shrink-0" />
        <CompactKPI value={String(metrics.tractCount ?? "—")} label="Tracts" />
        <span className="w-px h-5 bg-arc-gray-300 dark:bg-arc-gray-700 flex-shrink-0" />
        <CompactKPI value={String(metrics.topVulnCount ?? "—")} label="High Vuln" />
        {alicePct != null && (
          <>
            <span className="w-px h-5 bg-arc-gray-300 dark:bg-arc-gray-700 flex-shrink-0" />
            <CompactKPI
              value={`${alicePct.toFixed(0)}%`}
              label="ALICE"
              sublabel={aliceAbsolute != null ? `(${aliceAbsolute.toLocaleString()})` : undefined}
            />
          </>
        )}
      </div>

      {/* Live Reports feed — takes remaining space */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-arc-red/20 bg-arc-red/10 dark:bg-arc-red/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-arc-red rounded-full animate-pulse" />
          <span className="text-[10px] font-data font-bold uppercase tracking-widest text-arc-red">
            Storm Reports
          </span>
          <span className="text-[10px] font-data text-arc-gray-500 dark:text-white/60">
            {stormReportCount} of {STORM_REPORTS.length}
          </span>
        </div>
        {countdown && (
          <span className="font-data font-bold text-xs text-arc-red tabular-nums">
            {countdown}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto border-b border-arc-gray-100 dark:border-arc-gray-700">
        {visibleReports.map((r, i) => (
          <div
            key={r.id}
            className={`flex gap-3 px-4 py-2.5 border-b border-arc-gray-100/50 dark:border-arc-gray-700/50 last:border-b-0 ${
              i === 0 ? "bg-arc-red/10 dark:bg-arc-red/20" : ""
            }`}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-600 border-2 border-yellow-400 flex items-center justify-center mt-0.5">
              <span className="text-white font-data font-bold text-xs">{r.letter}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`font-data font-bold text-[10px] tabular-nums ${
                  i === 0 ? "text-arc-red" : "text-arc-gray-500 dark:text-white/60"
                }`}>
                  {r.time}
                </span>
                <span className={`font-data font-bold text-[10px] uppercase ${
                  i === 0 ? "text-arc-red" : "text-arc-gray-700 dark:text-white/80"
                }`}>
                  {r.source}
                </span>
                {i === 0 && (
                  <span className="text-[9px] font-data font-bold uppercase tracking-wider bg-arc-red text-white px-1.5 py-0.5 rounded">
                    Latest
                  </span>
                )}
              </div>
              <p className={`font-data text-[11px] leading-snug ${
                i === 0
                  ? "text-arc-black dark:text-white font-semibold"
                  : "text-arc-gray-700 dark:text-white/70"
              }`}>
                <span className="text-arc-red font-bold">{r.label}</span> — {r.location}
              </p>
            </div>
          </div>
        ))}
        {stormReportCount === 0 && (
          <div className="px-4 py-6 text-center text-[11px] font-data text-arc-gray-500 dark:text-white/50 uppercase tracking-wider">
            Awaiting first report...
          </div>
        )}
        {stormComplete && onRestart && (
          <div className="px-4 py-4 text-center">
            <button
              type="button"
              onClick={onRestart}
              className="px-4 py-2 bg-arc-red text-white font-data font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-colors"
            >
              Restart Simulation
            </button>
          </div>
        )}
      </div>

      {/* Asset breakdown — compact */}
      <div className="px-4 py-2.5 border-b border-arc-gray-100 dark:border-arc-gray-700 flex-shrink-0">
        <div className="text-[10px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-white/80 mb-1.5">
          Assets in Footprint
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {mhps.length > 0 && (
            <AssetRow label="MHPs" count={mhps.length} detail={`${totalMhpUnits.toLocaleString()} units`} critical />
          )}
          {schools.length > 0 && (
            <AssetRow label="Schools" count={schools.length} detail={`${totalEnrollment.toLocaleString()} enrolled`} />
          )}
          {hospitals.length > 0 && (
            <AssetRow label="Hospitals" count={hospitals.length} detail={`${totalBeds.toLocaleString()} beds`} />
          )}
          {rcSites.length > 0 && (
            <AssetRow label="Red Cross" count={rcSites.length} detail={`${totalErvs} ERVs`} />
          )}
          {fireStations.length > 0 && <AssetRow label="Fire" count={fireStations.length} />}
          {policeStations.length > 0 && <AssetRow label="Police" count={policeStations.length} />}
        </div>
      </div>

      {/* Top vulnerable tracts */}
      {topTracts.length > 0 && (
        <div className="px-4 py-2.5 flex-shrink-0">
          <div className="text-[10px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-white/80 mb-1">
            Most Vulnerable
          </div>
          <div className="flex flex-wrap gap-1">
            {topTracts.slice(0, 5).map((t) => (
              <button
                key={t.geoid}
                type="button"
                onClick={() => onTractClick?.(t.geoid || t.name)}
                className="px-1.5 py-0.5 text-[10px] font-data bg-arc-cream dark:bg-arc-black/40 border border-arc-gray-300 dark:border-arc-gray-700 text-arc-black dark:text-arc-cream hover:border-arc-red transition-colors tabular-nums"
              >
                {shortTractName(t.name)} · SVI {((t.rpl_themes ?? 0) * 100).toFixed(0)}%
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactKPI({
  value,
  label,
  highlight,
  sublabel,
}: {
  value: string;
  label: string;
  highlight?: boolean;
  sublabel?: string;
}) {
  return (
    <div className="flex items-baseline gap-1 whitespace-nowrap flex-shrink-0">
      <span className={`font-data font-bold text-sm tabular-nums ${highlight ? "text-arc-red" : "text-arc-black dark:text-arc-cream"}`}>
        {value}
      </span>
      <span className="text-[9px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-white/70">
        {label}
      </span>
      {sublabel && (
        <span className="text-[9px] font-data text-arc-gray-500 dark:text-white/50 tabular-nums">
          {sublabel}
        </span>
      )}
    </div>
  );
}

function AssetRow({
  label,
  count,
  detail,
  critical,
}: {
  label: string;
  count: number;
  detail?: string;
  critical?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-data font-bold text-sm tabular-nums ${critical ? "text-arc-red" : "text-arc-black dark:text-arc-cream"}`}>
        {count}
      </span>
      <span className="font-data text-xs text-arc-gray-700 dark:text-white/80">{label}</span>
      {detail && (
        <span className="font-data text-[10px] text-arc-gray-500 dark:text-white/60 tabular-nums">({detail})</span>
      )}
    </div>
  );
}
