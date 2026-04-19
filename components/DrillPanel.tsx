"use client";

import type { AssetType } from "./MapView";

export interface DrillAsset {
  id: string;
  type: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  attrs: Record<string, unknown>;
}

interface Props {
  category: AssetType;
  assets: DrillAsset[];
  onSelect?: (a: DrillAsset) => void;
  highlightId?: string | null;
}

export default function DrillPanel({
  category,
  assets,
  onSelect,
  highlightId,
}: Props) {
  const cfg = configFor(category, assets);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {cfg.summary && (
        <div className="px-4 py-3 border-b border-arc-gray-100 dark:border-arc-gray-700 bg-arc-cream/60 dark:bg-arc-black/60">
          {cfg.summary}
        </div>
      )}
      <div className="flex-1 overflow-y-auto divide-y divide-arc-gray-100 dark:divide-arc-gray-700">
        {assets.length === 0 && (
          <div className="p-4 text-xs text-arc-gray-500 dark:text-arc-gray-300 italic">
            No {cfg.title.toLowerCase()} inside the warning footprint.
          </div>
        )}
        {assets.map((a) => {
          const clickable = Boolean(onSelect);
          const isHighlighted = highlightId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={clickable ? () => onSelect?.(a) : undefined}
              disabled={!clickable}
              className={`w-full text-left p-3 text-xs transition-colors ${
                isHighlighted
                  ? "bg-arc-red/10 ring-2 ring-arc-red ring-inset"
                  : clickable
                  ? "hover:bg-arc-cream/60 dark:hover:bg-arc-black/40 cursor-pointer"
                  : "cursor-default"
              }`}
            >
              <RowHeader name={a.name} />
              <RowAddress value={`${a.address}, ${a.city}`} />
              {cfg.renderTags(a.attrs)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CategoryConfig {
  title: string;
  summary: React.ReactNode | null;
  renderTags: (attrs: Record<string, unknown>) => React.ReactNode;
}

export function configFor(category: AssetType, rows: DrillAsset[]): CategoryConfig {
  const attrs = rows.map((r) => r.attrs || {});
  switch (category) {
    case "mobile_home_park": {
      const units = sum(attrs, "units");
      const avgOver65 =
        rows.length > 0
          ? Math.round(
              (attrs.reduce((s, a) => s + (Number(a.pct_over_65) || 0), 0) /
                rows.length) *
                100
            )
          : 0;
      return {
        title: "Mobile Home Parks",
        summary: (
          <Totals
            items={[
              { label: "Units", value: units.toLocaleString() },
              { label: "Parks", value: String(rows.length) },
              avgOver65 > 0 && {
                label: "Avg % 65+",
                value: `${avgOver65}%`,
                warn: avgOver65 >= 50,
              },
            ]}
          />
        ),
        renderTags: (a) => (
          <RowTags
            tags={[
              { label: "Units", value: a.units },
              a.pct_over_65 != null && {
                label: "% 65+",
                value: `${Math.round(Number(a.pct_over_65) * 100)}%`,
                warn: Number(a.pct_over_65) >= 0.5,
              },
              a.median_age != null && {
                label: "Median age",
                value: a.median_age,
              },
              a.occupancy_pct != null && {
                label: "Occupancy",
                value: `${Math.round(Number(a.occupancy_pct) * 100)}%`,
              },
            ]}
          />
        ),
      };
    }

    case "school": {
      const enrollment = sum(attrs, "enrollment");
      const shelters = attrs.filter((a) => a.shelter_agreement === true).length;
      return {
        title: "Schools",
        summary: (
          <Totals
            items={[
              { label: "Enrollment", value: enrollment.toLocaleString() },
              { label: "Schools", value: String(rows.length) },
              shelters > 0 && { label: "Shelter sites", value: String(shelters) },
            ]}
          />
        ),
        renderTags: (a) => (
          <RowTags
            tags={[
              { label: "Level", value: a.level },
              { label: "Enrollment", value: Number(a.enrollment).toLocaleString() },
              {
                label: "Shelter",
                value: a.shelter_agreement ? "Yes" : "No",
              },
              { label: "Generator", value: a.has_generator ? "Yes" : "No" },
            ]}
          />
        ),
      };
    }

    case "hospital": {
      const beds = sum(attrs, "beds");
      const trauma = attrs.filter((a) => a.has_trauma_center === true).length;
      const dialysis = sum(attrs, "home_dialysis_patients_served");
      return {
        title: "Hospitals",
        summary: (
          <Totals
            items={[
              { label: "Beds", value: beds.toLocaleString() },
              { label: "Hospitals", value: String(rows.length) },
              trauma > 0 && { label: "Trauma centers", value: String(trauma) },
              dialysis > 0 && {
                label: "Home dialysis",
                value: dialysis.toLocaleString(),
              },
            ]}
          />
        ),
        renderTags: (a) => (
          <RowTags
            tags={[
              { label: "Beds", value: a.beds },
              { label: "ER", value: a.has_er ? "Yes" : "No" },
              {
                label: "Trauma",
                value: a.has_trauma_center ? "Yes" : "No",
                warn: a.has_trauma_center === false,
              },
              { label: "Generator", value: a.has_generator ? "Yes" : "No" },
            ]}
          />
        ),
      };
    }

    case "red_cross": {
      const ervs = sum(attrs, "erv_count");
      const shelterCap = sum(attrs, "shelter_capacity");
      return {
        title: "Red Cross Sites",
        summary: (
          <Totals
            items={[
              { label: "Sites", value: String(rows.length) },
              ervs > 0 && { label: "ERVs", value: String(ervs) },
              shelterCap > 0 && {
                label: "Shelter capacity",
                value: shelterCap.toLocaleString(),
              },
            ]}
          />
        ),
        renderTags: (a) => (
          <RowTags
            tags={[
              { label: "Role", value: formatRole(a.role) },
              a.erv_count != null && { label: "ERVs", value: a.erv_count },
              a.shelter_capacity != null &&
                Number(a.shelter_capacity) > 0 && {
                  label: "Shelter cap",
                  value: Number(a.shelter_capacity).toLocaleString(),
                },
              a.operational_status && {
                label: "Status",
                value: String(a.operational_status),
              },
            ]}
          />
        ),
      };
    }

    case "fire_station": {
      const staff = sum(attrs, "staff_oncall");
      const ladders = attrs.filter((a) => a.has_ladder === true).length;
      return {
        title: "Fire Stations",
        summary: (
          <Totals
            items={[
              { label: "Stations", value: String(rows.length) },
              staff > 0 && { label: "On-call", value: String(staff) },
              ladders > 0 && { label: "Ladder trucks", value: String(ladders) },
            ]}
          />
        ),
        renderTags: (a) => (
          <RowTags
            tags={[
              { label: "Agency", value: a.agency },
              { label: "Ladder", value: a.has_ladder ? "Yes" : "No" },
              a.staff_oncall != null && {
                label: "On-call",
                value: a.staff_oncall,
              },
            ]}
          />
        ),
      };
    }

    case "police_station": {
      const officers = sum(attrs, "sworn_officers");
      return {
        title: "Police Stations",
        summary: (
          <Totals
            items={[
              { label: "Stations", value: String(rows.length) },
              officers > 0 && {
                label: "Sworn officers",
                value: officers.toLocaleString(),
              },
            ]}
          />
        ),
        renderTags: (a) => (
          <RowTags
            tags={[
              { label: "Agency", value: a.agency },
              a.sworn_officers != null && {
                label: "Officers",
                value: Number(a.sworn_officers).toLocaleString(),
              },
            ]}
          />
        ),
      };
    }
  }
}

function formatRole(role: unknown): string {
  if (!role) return "—";
  return String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sum(attrs: Record<string, unknown>[], key: string): number {
  return attrs.reduce((s, a) => s + (Number(a[key]) || 0), 0);
}

function RowHeader({ name }: { name?: string }) {
  return (
    <div className="font-semibold text-sm text-arc-black dark:text-arc-cream">
      {name || "Unnamed"}
    </div>
  );
}

function RowAddress({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <div className="text-arc-gray-500 dark:text-arc-gray-300 mt-0.5">{value}</div>
  );
}

type TagEntry =
  | { label: string; value: unknown; warn?: boolean }
  | false
  | null
  | undefined;

function RowTags({ tags }: { tags: TagEntry[] }) {
  const cleaned = tags.filter(
    (t): t is { label: string; value: unknown; warn?: boolean } => Boolean(t)
  );
  if (cleaned.length === 0) return null;
  return (
    <div className="flex gap-3 flex-wrap mt-2">
      {cleaned.map((t, i) => (
        <div key={i}>
          <div className="text-[9px] font-data uppercase tracking-wider text-arc-gray-500 dark:text-arc-gray-300">
            {t.label}
          </div>
          <div
            className={`text-xs font-semibold ${
              t.warn ? "text-arc-red" : "text-arc-black dark:text-arc-cream"
            }`}
          >
            {t.value == null || t.value === "" ? "—" : String(t.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Totals({
  items,
}: {
  items: (
    | { label: string; value: string; warn?: boolean }
    | false
    | null
    | undefined
  )[];
}) {
  const cleaned = items.filter(
    (i): i is { label: string; value: string; warn?: boolean } => Boolean(i)
  );
  return (
    <div className="flex gap-4 flex-wrap">
      {cleaned.map((item, i) => (
        <div key={i}>
          <div className="text-[9px] font-data uppercase tracking-wider text-arc-gray-500 dark:text-arc-gray-300">
            {item.label}
          </div>
          <div
            className={`text-sm font-headline font-bold ${
              item.warn ? "text-arc-red" : "text-arc-black dark:text-arc-cream"
            }`}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
