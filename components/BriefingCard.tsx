"use client";

import { useEffect, useState } from "react";
import type { DrillAsset } from "./DrillPanel";
import type { AssetType } from "./MapView";
import { ASSET_TYPES } from "./MapView";

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
}: Props) {
  const mhps = footprintByCategory.mobile_home_park ?? [];
  const schools = footprintByCategory.school ?? [];
  const hospitals = footprintByCategory.hospital ?? [];
  const rcSites = footprintByCategory.red_cross ?? [];
  const fireStations = footprintByCategory.fire_station ?? [];
  const policeStations = footprintByCategory.police_station ?? [];

  const totalMhpUnits = mhps.reduce(
    (s, a) => s + (Number(a.attrs?.units) || 0),
    0,
  );
  const totalEnrollment = schools.reduce(
    (s, a) => s + (Number(a.attrs?.enrollment) || 0),
    0,
  );
  const totalBeds = hospitals.reduce(
    (s, a) => s + (Number(a.attrs?.beds) || 0),
    0,
  );
  const totalErvs = rcSites.reduce(
    (s, a) => s + (Number(a.attrs?.erv_count) || 0),
    0,
  );

  const pop = metrics.popInFootprint;
  const alicePct = metrics.aliceStruggling;
  const aliceAbsolute =
    pop != null && alicePct != null
      ? Math.round((alicePct / 100) * pop)
      : null;

  return (
    <div className="border-b border-arc-gray-100 dark:border-arc-gray-700 bg-white dark:bg-arc-gray-900">
      {/* Live incoming reports */}
      <LiveReportsFeed countdown={countdown} />

      {/* Primary KPIs */}
      <div className="grid grid-cols-3 divide-x divide-arc-gray-100 dark:divide-arc-gray-700 border-b border-arc-gray-100 dark:border-arc-gray-700">
        <KPI
          value={pop != null ? pop.toLocaleString() : "—"}
          label="People at Risk"
          highlight
        />
        <KPI
          value={String(metrics.tractCount ?? "—")}
          label="Tracts Impacted"
        />
        <KPI
          value={String(metrics.topVulnCount ?? "—")}
          label="High Vulnerability"
          sublabel="SVI top decile"
        />
      </div>

      {/* Asset breakdown */}
      <div className="px-4 py-3 border-b border-arc-gray-100 dark:border-arc-gray-700">
        <div className="text-[10px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-white/80 mb-2">
          Assets in Footprint
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {mhps.length > 0 && (
            <AssetRow
              label="Mobile Home Parks"
              count={mhps.length}
              detail={`${totalMhpUnits.toLocaleString()} units`}
              critical
            />
          )}
          {schools.length > 0 && (
            <AssetRow
              label="Schools"
              count={schools.length}
              detail={`${totalEnrollment.toLocaleString()} enrolled`}
            />
          )}
          {hospitals.length > 0 && (
            <AssetRow
              label="Hospitals"
              count={hospitals.length}
              detail={`${totalBeds.toLocaleString()} beds`}
            />
          )}
          {rcSites.length > 0 && (
            <AssetRow
              label="Red Cross Sites"
              count={rcSites.length}
              detail={`${totalErvs} ERVs`}
            />
          )}
          {fireStations.length > 0 && (
            <AssetRow
              label="Fire Stations"
              count={fireStations.length}
            />
          )}
          {policeStations.length > 0 && (
            <AssetRow
              label="Police Stations"
              count={policeStations.length}
            />
          )}
        </div>
      </div>

      {/* ALICE + top vulnerable tracts */}
      <div className="px-4 py-3">
        {alicePct != null && (
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-white/80">
              ALICE
            </span>
            <span className="font-data font-bold text-sm text-arc-black dark:text-arc-cream tabular-nums">
              {alicePct.toFixed(1)}%
            </span>
            {aliceAbsolute != null && (
              <span className="font-data text-xs text-arc-gray-500 dark:text-white/80 tabular-nums">
                ({aliceAbsolute.toLocaleString()} people)
              </span>
            )}
          </div>
        )}

        {topTracts.length > 0 && (
          <div>
            <div className="text-[10px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-white/80 mb-1.5">
              Most Vulnerable Areas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topTracts.slice(0, 5).map((t) => (
                <button
                  key={t.geoid}
                  type="button"
                  onClick={() => onTractClick?.(t.geoid || t.name)}
                  className="px-2 py-1 text-[11px] font-data bg-arc-cream dark:bg-arc-black/40 border border-arc-gray-300 dark:border-arc-gray-700 text-arc-black dark:text-arc-cream hover:border-arc-red transition-colors tabular-nums"
                >
                  {shortTractName(t.name)} · SVI{" "}
                  {((t.rpl_themes ?? 0) * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const LIVE_REPORTS = [
  {
    time: "4:15 PM",
    source: "NWS Tampa Bay",
    text: "Severe thunderstorm producing a TORNADO located near Seminole Blvd and Park Blvd, moving NE at 35 mph. TAKE COVER NOW.",
    critical: true,
  },
  {
    time: "4:21 PM",
    source: "Pinellas Sheriff",
    text: "Report of funnel cloud near the intersection of Ulmerton Rd and Starkey Rd. Deputies responding. Avoid the area.",
    critical: true,
  },
  {
    time: "4:24 PM",
    source: "NWS Tampa Bay",
    text: "CONFIRMED TORNADO on the ground near Pinellas Park. Debris signature detected on radar.",
    critical: true,
  },
  {
    time: "4:26 PM",
    source: "Pinellas Sheriff",
    text: "Multiple 911 calls reporting structural damage near 66th St N and 54th Ave N. Power lines down. First responders en route.",
    critical: false,
  },
  {
    time: "4:28 PM",
    source: "PCFD Station 32",
    text: "Engine 32 and Rescue 32 dispatched to mobile home park at 7200 block of 46th Ave N. Reports of roof damage and injuries.",
    critical: false,
  },
  {
    time: "4:30 PM",
    source: "Duke Energy",
    text: "Approximately 8,400 customers without power in Pinellas Park and Lealman areas. Crews staging.",
    critical: false,
  },
  {
    time: "4:33 PM",
    source: "NWS Tampa Bay",
    text: "Tornado continuing NE across Pinellas. Estimated path width 200 yards. Expected to cross I-275 near 38th Ave N by 4:40 PM.",
    critical: true,
  },
  {
    time: "4:35 PM",
    source: "Pinellas Sheriff",
    text: "Overturned vehicles on US-19 near Park Blvd interchange. Northbound lanes blocked.",
    critical: false,
  },
];

function LiveReportsFeed({ countdown }: { countdown: string | null }) {
  const [visibleCount, setVisibleCount] = useState(2);

  useEffect(() => {
    if (visibleCount >= LIVE_REPORTS.length) return;
    const timer = setInterval(() => {
      setVisibleCount((c) => Math.min(c + 1, LIVE_REPORTS.length));
    }, 10000);
    return () => clearInterval(timer);
  }, [visibleCount]);

  // Show newest first
  const visible = LIVE_REPORTS.slice(0, visibleCount).reverse();

  return (
    <div className="border-b border-arc-red/30 bg-arc-red/10 dark:bg-arc-red/20">
      <div className="px-4 py-2 flex items-center justify-between border-b border-arc-red/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-arc-red rounded-full animate-pulse" />
          <span className="text-[10px] font-data font-bold uppercase tracking-widest text-arc-red">
            Live Reports
          </span>
        </div>
        {countdown && (
          <span className="font-data font-bold text-xs text-arc-red tabular-nums">
            {countdown}
          </span>
        )}
      </div>
      <div className="max-h-[140px] overflow-y-auto">
        {visible.map((r, i) => (
          <div
            key={r.time + r.source}
            className={`px-4 py-2 border-b border-arc-red/10 last:border-b-0 ${
              i === 0
                ? "bg-arc-red/20 dark:bg-arc-red/30"
                : ""
            }`}
          >
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
                  New
                </span>
              )}
            </div>
            <p className={`font-data text-[11px] leading-snug ${
              i === 0
                ? "text-arc-black dark:text-white font-semibold"
                : "text-arc-gray-700 dark:text-white/70"
            }`}>
              {r.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPI({
  value,
  label,
  sublabel,
  highlight,
}: {
  value: string;
  label: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-3 py-3 text-center">
      <div
        className={`font-headline font-bold text-2xl leading-none tabular-nums ${
          highlight
            ? "text-arc-red"
            : "text-arc-black dark:text-arc-cream"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-white/80 mt-1">
        {label}
      </div>
      {sublabel && (
        <div className="text-[9px] font-data text-arc-gray-400 dark:text-white/50 mt-0.5">
          {sublabel}
        </div>
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
      <span
        className={`font-data font-bold text-sm tabular-nums ${
          critical
            ? "text-arc-red"
            : "text-arc-black dark:text-arc-cream"
        }`}
      >
        {count}
      </span>
      <span className="font-data text-xs text-arc-gray-700 dark:text-white/80">
        {label}
      </span>
      {detail && (
        <span className="font-data text-[10px] text-arc-gray-500 dark:text-white/60 tabular-nums">
          ({detail})
        </span>
      )}
    </div>
  );
}
