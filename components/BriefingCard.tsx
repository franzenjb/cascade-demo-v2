"use client";

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
      {/* Header */}
      <div className="px-4 py-3 bg-arc-red/10 dark:bg-arc-red/20 border-b border-arc-red/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-arc-red rounded-full animate-pulse" />
            <span className="font-headline font-bold text-base text-arc-red uppercase tracking-wide">
              Tornado Warning
            </span>
          </div>
          {countdown && (
            <span className="font-data font-bold text-sm text-arc-red tabular-nums">
              {countdown}
            </span>
          )}
        </div>
        <p className="text-sm text-arc-black dark:text-arc-cream leading-relaxed">
          The National Weather Service has issued a <span className="font-bold">Tornado Warning</span> for
          central Pinellas County. A severe thunderstorm capable of producing a tornado was located
          near Seminole, moving northeast at 35 mph. Path tracks NE across the peninsula from
          Seminole through Largo, Pinellas Park, and into north St. Petersburg, exiting into Tampa Bay
          near Gandy Boulevard.
        </p>
        <p className="text-xs text-arc-gray-700 dark:text-white mt-1.5 font-data font-bold">
          TAKE COVER NOW. Move to an interior room on the lowest floor of a sturdy building.
        </p>
      </div>

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
