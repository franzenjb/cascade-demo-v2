"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type {
  ChatMessage,
  GeoJSONPolygon,
  MapInstruction,
} from "@/lib/types";
import ChatPanel from "@/components/ChatPanel";
import TriggerButton from "@/components/TriggerButton";
import LayerPanel from "@/components/LayerPanel";
import DrillPanel, { type DrillAsset } from "@/components/DrillPanel";
import AllAssetsAccordion from "@/components/AllAssetsAccordion";
import { AssetIcon } from "@/components/AssetIcons";
import {
  ASSET_TYPES,
  type AssetLayerVisibility,
  type AssetType,
  type FocusTarget,
} from "@/components/MapView";
import assetsJson from "@/data/pinellas_assets.json";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const CENTER: [number, number] = [
  Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? -82.75),
  Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 27.88),
];
const ZOOM = Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 10);

const DEFAULT_VISIBILITY: AssetLayerVisibility = {
  red_cross: true,
  hospital: true,
  mobile_home_park: true,
  school: false,
  fire_station: false,
  police_station: false,
};

const FULL_ASSETS: DrillAsset[] = (
  assetsJson as { assets: DrillAsset[] }
).assets.map((a) => ({
  id: a.id,
  type: a.type,
  name: a.name,
  lat: a.lat,
  lon: a.lon,
  address: a.address,
  city: a.city,
  attrs: a.attrs || {},
}));

const FULL_BY_CATEGORY: Partial<Record<AssetType, DrillAsset[]>> = (() => {
  const g: Partial<Record<AssetType, DrillAsset[]>> = {};
  for (const a of FULL_ASSETS) {
    const k = a.type as AssetType;
    (g[k] ||= []).push(a);
  }
  return g;
})();

function boundsForRows(
  rows: { lat: number; lon: number }[],
): [[number, number], [number, number]] | null {
  if (rows.length === 0) return null;
  let minLng = rows[0].lon;
  let maxLng = rows[0].lon;
  let minLat = rows[0].lat;
  let maxLat = rows[0].lat;
  for (const r of rows) {
    if (r.lon < minLng) minLng = r.lon;
    if (r.lon > maxLng) maxLng = r.lon;
    if (r.lat < minLat) minLat = r.lat;
    if (r.lat > maxLat) maxLat = r.lat;
  }
  if (minLng === maxLng && minLat === maxLat) {
    const pad = 0.02;
    return [
      [minLng - pad, minLat - pad],
      [maxLng + pad, maxLat + pad],
    ];
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function allOn(): AssetLayerVisibility {
  return Object.fromEntries(
    ASSET_TYPES.map((t) => [t.key, true]),
  ) as AssetLayerVisibility;
}

function onlyThis(cat: AssetType): AssetLayerVisibility {
  return Object.fromEntries(
    ASSET_TYPES.map((t) => [t.key, t.key === cat]),
  ) as AssetLayerVisibility;
}

interface ActiveWarning {
  nwsEventId: string;
  expires: string;
  scenarioId: string;
}

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

type RightTab = "conversation" | "drill";
type DrillScope = "footprint" | "all";

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instructions, setInstructions] = useState<MapInstruction[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [triggerDirective, setTriggerDirective] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [clearSignal, setClearSignal] = useState(0);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [assetVisibility, setAssetVisibility] =
    useState<AssetLayerVisibility>(DEFAULT_VISIBILITY);
  const [activeWarning, setActiveWarning] = useState<ActiveWarning | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  const [footprintByCategory, setFootprintByCategory] = useState<
    Partial<Record<AssetType, DrillAsset[]>>
  >({});
  const [metrics, setMetrics] = useState<SituationMetrics | null>(null);
  const [topTracts, setTopTracts] = useState<TractHit[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("conversation");
  const [activeCategory, setActiveCategory] = useState<AssetType | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [drillScope, setDrillScope] = useState<DrillScope>("all");
  const [accordionResetSignal, setAccordionResetSignal] = useState(0);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [streamTick, setStreamTick] = useState(0);

  const footprintIdsByCategory = useMemo(() => {
    const g: Partial<Record<AssetType, Set<string>>> = {};
    for (const t of ASSET_TYPES) {
      const ids = (footprintByCategory[t.key] ?? []).map((a) => a.id);
      g[t.key] = new Set(ids);
    }
    return g;
  }, [footprintByCategory]);

  const fullCounts = useMemo(() => {
    const c: Partial<Record<AssetType, number>> = {};
    for (const t of ASSET_TYPES) c[t.key] = FULL_BY_CATEGORY[t.key]?.length ?? 0;
    return c;
  }, []);

  const footprintCounts = useMemo(() => {
    const c: Partial<Record<AssetType, number>> = {};
    for (const t of ASSET_TYPES)
      c[t.key] = footprintByCategory[t.key]?.length ?? 0;
    return c;
  }, [footprintByCategory]);

  const totalFootprint = useMemo(
    () => Object.values(footprintCounts).reduce((s, n) => s + (n ?? 0), 0),
    [footprintCounts],
  );

  useEffect(() => {
    if (!activeWarning) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const diffMs = new Date(activeWarning.expires).getTime() - Date.now();
      if (diffMs <= 0) {
        setCountdown("EXPIRED");
        return;
      }
      const m = Math.floor(diffMs / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      setCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeWarning]);

  const onUserMessage = (m: ChatMessage) => {
    setMessages((prev) => [...prev, m, { role: "assistant", content: "" }]);
  };

  const onAssistantDelta = (text: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") {
        copy[copy.length - 1] = { ...last, content: last.content + text };
      }
      return copy;
    });
  };

  const onMapInstruction = (m: MapInstruction) => {
    setInstructions((prev) => [...prev, m]);
  };

  const onToolCall = (name: string) => {
    setToolActivity(prettyToolName(name));
  };

  const onToolResult = (name: string, parsed: Record<string, unknown>) => {
    setToolActivity(null);

    if (name === "get_assets_in_polygon") {
      const raw = (parsed.assets as DrillAsset[]) || [];
      const grouped: Partial<Record<AssetType, DrillAsset[]>> = {};
      for (const a of raw) {
        const key = a.type as AssetType;
        (grouped[key] ||= []).push(a);
      }
      setFootprintByCategory(grouped);
      setDrillScope("footprint");
      setMetrics((prev) => ({
        popInFootprint: prev?.popInFootprint ?? null,
        tractCount: prev?.tractCount ?? null,
        topVulnCount: prev?.topVulnCount ?? null,
        topTract: prev?.topTract ?? null,
        totalAssets: raw.length,
        aliceStruggling: prev?.aliceStruggling ?? null,
      }));
      if (!activeCategory) {
        const first = ASSET_TYPES.find((t) => (grouped[t.key]?.length ?? 0) > 0);
        if (first) setActiveCategory(first.key);
      }
    }

    if (name === "get_tracts_intersecting_polygon") {
      const hits = (parsed.top_tracts_by_vulnerability as TractHit[]) || [];
      const topVuln = hits.filter((h) => (h.rpl_themes ?? 0) >= 0.9).length;
      setTopTracts(hits);
      setMetrics((prev) => ({
        popInFootprint: Number(parsed.total_population_inside) || 0,
        tractCount: Number(parsed.intersecting_tract_count) || 0,
        topVulnCount: topVuln,
        topTract: hits[0] || null,
        totalAssets: prev?.totalAssets ?? null,
        aliceStruggling: prev?.aliceStruggling ?? null,
      }));
    }

    if (name === "get_alice_poverty") {
      const alice = parsed.alice as Record<string, unknown> | null | undefined;
      const struggling = alice ? Number(alice.pct_struggling) : null;
      setMetrics((prev) => ({
        popInFootprint: prev?.popInFootprint ?? null,
        tractCount: prev?.tractCount ?? null,
        topVulnCount: prev?.topVulnCount ?? null,
        topTract: prev?.topTract ?? null,
        totalAssets: prev?.totalAssets ?? null,
        aliceStruggling: struggling,
      }));
    }
  };

  const onTurnEnd = () => {
    setToolActivity(null);
    setStreamTick((n) => n + 1);
  };

  const handleTriggerFired = (payload: {
    directive: string;
    polygon: unknown;
    scenarioId: string;
    focusCenter: [number, number];
    focusZoom: number;
    nwsEventId: string;
    expires: string;
  }) => {
    setMessages([]);
    setInstructions([]);
    setFootprintByCategory({});
    setMetrics(null);
    setTopTracts([]);
    setActiveCategory(null);
    setHighlightId(null);
    setDrillScope("footprint");
    setStreamTick(0);
    setRightTab("conversation");
    setClearSignal((n) => n + 1);
    setFocusTarget({ center: payload.focusCenter, zoom: payload.focusZoom });
    setInstructions([
      {
        action: "draw",
        geometry: payload.polygon as GeoJSONPolygon,
        style: { color: "#ED1B2E", opacity: 0.14, label: "Tornado Warning" },
        layer_label: "Tornado Warning",
      },
    ]);
    setScenarioId(payload.scenarioId);
    setTriggerDirective(payload.directive);
    setActiveWarning({
      nwsEventId: payload.nwsEventId,
      expires: payload.expires,
      scenarioId: payload.scenarioId,
    });
  };

  const totalFullAssets = FULL_ASSETS.length;

  useEffect(() => {
    if (streamTick === 0) return;
    if (totalFootprint > 0 && rightTab === "conversation") {
      setRightTab("drill");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamTick]);

  const activeCategoryLabel = activeCategory
    ? ASSET_TYPES.find((t) => t.key === activeCategory)?.label || "Assets"
    : "All Landmarks";

  const drillRows: DrillAsset[] = useMemo(() => {
    if (!activeCategory) return [];
    if (drillScope === "footprint")
      return footprintByCategory[activeCategory] ?? [];
    return FULL_BY_CATEGORY[activeCategory] ?? [];
  }, [activeCategory, drillScope, footprintByCategory]);

  const drillEmpty =
    activeCategory && drillScope === "footprint"
      ? "No landmarks of this type inside the warning footprint."
      : "No landmarks in this category.";

  const assetTabCount = activeCategory
    ? drillRows.length
    : totalFullAssets;

  const flyToAsset = (a: DrillAsset) => {
    setHighlightId(a.id);
    setFocusTarget({ center: [a.lon, a.lat], zoom: 14 });
  };

  const handleAssetClick = (a: DrillAsset) => {
    const cat = a.type as AssetType;
    setActiveCategory(cat);
    setHighlightId(a.id);
    setRightTab("drill");
    setFocusTarget({ center: [a.lon, a.lat], zoom: 14 });
    // If we're in footprint mode but this pin isn't in the footprint, flip to "all"
    const inFootprint = footprintIdsByCategory[cat]?.has(a.id) ?? false;
    if (!inFootprint) setDrillScope("all");
  };

  const handleAllChip = () => {
    setActiveCategory(null);
    setHighlightId(null);
    setRightTab("drill");
    setAccordionResetSignal((n) => n + 1);
    const b = boundsForRows(FULL_ASSETS);
    if (b) setFocusTarget({ bounds: b, padding: 80, maxZoom: 11 });
    setAssetVisibility(allOn());
  };

  const handleTypeChip = (cat: AssetType) => {
    setActiveCategory(cat);
    setRightTab("drill");
    setHighlightId(null);
    const rows =
      hasFootprint && drillScope === "footprint"
        ? footprintByCategory[cat] ?? []
        : FULL_BY_CATEGORY[cat] ?? [];
    const b = boundsForRows(rows);
    if (b) setFocusTarget({ bounds: b, padding: 80, maxZoom: 13 });
    setAssetVisibility(onlyThis(cat));
  };

  const copyBriefing = async () => {
    const last = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.trim());
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.content);
    } catch {
      // ignore
    }
  };

  const printBriefing = () => {
    window.print();
  };

  const hasFootprint = totalFootprint > 0;

  return (
    <main className="h-screen flex flex-col bg-arc-cream dark:bg-arc-black">
      <header className="bg-arc-maroon text-white shadow-md">
        <div className="px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-arc-red" aria-hidden />
            <div>
              <h1 className="font-headline text-lg leading-tight">
                Cascade{" "}
                <span className="text-white/60 text-xs font-data uppercase tracking-widest">
                  v2
                </span>
              </h1>
              <p className="text-[10px] font-data uppercase tracking-widest text-white/70">
                Pinellas County · FL · Operational Briefing Layer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 flex-wrap">
            <Stat label="Population" value="959,107" />
            <Stat label="Census Tracts" value="245" />
            <Stat label="FEMA Declarations" value="36" />
            <Stat label="% Struggling (ALICE)" value="25.2%" />
            {activeWarning && (
              <div className="flex items-center gap-2 px-3 py-1 bg-arc-red/20 border border-arc-red animate-pulse">
                <span className="w-2 h-2 bg-arc-red rounded-full" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[9px] font-data uppercase tracking-widest text-white/80">
                    Active Warning
                  </span>
                  <span className="text-[11px] font-data font-semibold">
                    {activeWarning.nwsEventId} · {countdown}
                  </span>
                </div>
              </div>
            )}
            <TriggerButton onFired={handleTriggerFired} />
          </div>
        </div>
        <div className="h-[2px] bg-arc-red" />
      </header>

      {metrics && (
        <div className="border-b border-arc-gray-100 dark:border-arc-gray-700 bg-white dark:bg-arc-gray-900 px-4 py-3 flex gap-5 overflow-x-auto">
          <Metric
            label="Population in footprint"
            value={
              metrics.popInFootprint != null
                ? metrics.popInFootprint.toLocaleString()
                : "—"
            }
          />
          <Metric
            label="Impacted tracts"
            value={metrics.tractCount != null ? String(metrics.tractCount) : "—"}
          />
          <Metric
            label="High-vuln (≥ 0.9 SVI)"
            value={
              metrics.topVulnCount != null ? String(metrics.topVulnCount) : "—"
            }
            warn={(metrics.topVulnCount ?? 0) > 0}
          />
          <Metric
            label="Named landmarks"
            value={
              metrics.totalAssets != null ? String(metrics.totalAssets) : "—"
            }
          />
          {metrics.topTract && (
            <Metric
              label="Most vulnerable tract"
              value={metrics.topTract.name}
              sub={`SVI ${((metrics.topTract.rpl_themes ?? 0) * 100).toFixed(0)}%`}
              warn
            />
          )}
        </div>
      )}

      <div className="border-b border-arc-gray-100 dark:border-arc-gray-700 bg-arc-cream/60 dark:bg-arc-black/40 px-4 py-2 flex gap-2 overflow-x-auto items-center">
        <Chip
          active={activeCategory === null}
          onClick={handleAllChip}
          label="All"
          count={totalFullAssets}
        />
        {ASSET_TYPES.map((t) => {
          const count =
            hasFootprint && drillScope === "footprint"
              ? footprintCounts[t.key] ?? 0
              : fullCounts[t.key] ?? 0;
          if (count === 0) return null;
          const active = activeCategory === t.key;
          const showFootprint = hasFootprint && drillScope === "footprint";
          return (
            <button
              key={t.key}
              onClick={() => handleTypeChip(t.key)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-data uppercase tracking-wider border transition-colors whitespace-nowrap ${
                active
                  ? "bg-arc-maroon text-white border-arc-maroon"
                  : "bg-white dark:bg-arc-gray-900 text-arc-gray-900 dark:text-arc-cream border-arc-gray-300 dark:border-arc-gray-700 hover:border-arc-maroon"
              }`}
            >
              <AssetIcon type={t.key} color={t.color} size={14} />
              <span>{t.label}</span>
              <span
                className={`font-semibold ${
                  active ? "text-white" : "text-arc-maroon"
                }`}
              >
                {count}
                {showFootprint && (
                  <span
                    className={`ml-1 text-[9px] font-data ${
                      active ? "text-white/70" : "text-arc-gray-500"
                    }`}
                  >
                    /{fullCounts[t.key] ?? 0}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {hasFootprint && activeCategory && (
          <div className="ml-auto flex items-center gap-1 text-[10px] font-data uppercase tracking-wider">
            <span className="text-arc-gray-500">Scope:</span>
            <button
              onClick={() => setDrillScope("footprint")}
              className={`px-2 py-0.5 border ${
                drillScope === "footprint"
                  ? "bg-arc-red text-white border-arc-red"
                  : "bg-white dark:bg-arc-gray-900 text-arc-gray-900 dark:text-arc-cream border-arc-gray-300 dark:border-arc-gray-700"
              }`}
            >
              Footprint
            </button>
            <button
              onClick={() => setDrillScope("all")}
              className={`px-2 py-0.5 border ${
                drillScope === "all"
                  ? "bg-arc-maroon text-white border-arc-maroon"
                  : "bg-white dark:bg-arc-gray-900 text-arc-gray-900 dark:text-arc-cream border-arc-gray-300 dark:border-arc-gray-700"
              }`}
            >
              All
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-0">
        <div className="min-h-[50vh] lg:min-h-0 relative">
          <MapView
            center={CENTER}
            zoom={ZOOM}
            instructions={instructions}
            clearSignal={clearSignal}
            focusTarget={focusTarget}
            assetVisibility={assetVisibility}
            onAssetClick={handleAssetClick}
          />
          <LayerPanel
            visibility={assetVisibility}
            onChange={setAssetVisibility}
          />
        </div>
        <div className="border-l border-arc-gray-100 dark:border-arc-gray-700 flex flex-col min-h-0 bg-white dark:bg-arc-gray-900">
          <div className="flex items-center border-b border-arc-gray-100 dark:border-arc-gray-700">
            <TabButton
              active={rightTab === "conversation"}
              onClick={() => setRightTab("conversation")}
              label="Conversation"
              count={messages.filter((m) => m.role === "assistant").length}
            />
            <TabButton
              active={rightTab === "drill"}
              onClick={() => setRightTab("drill")}
              label={activeCategoryLabel}
              count={assetTabCount}
            />
            <div className="ml-auto pr-2 flex gap-1">
              {streamTick > 0 && (
                <>
                  <button
                    onClick={copyBriefing}
                    className="text-[10px] font-data uppercase tracking-wider px-2 py-1 border border-arc-gray-300 dark:border-arc-gray-700 text-arc-gray-900 dark:text-arc-cream hover:border-arc-maroon hover:text-arc-maroon"
                    title="Copy briefing to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    onClick={printBriefing}
                    className="text-[10px] font-data uppercase tracking-wider px-2 py-1 border border-arc-gray-300 dark:border-arc-gray-700 text-arc-gray-900 dark:text-arc-cream hover:border-arc-maroon hover:text-arc-maroon"
                    title="Print briefing"
                  >
                    Print
                  </button>
                </>
              )}
            </div>
          </div>

          {rightTab === "conversation" && (
            <ChatPanel
              messages={messages}
              onUserMessage={onUserMessage}
              onAssistantDelta={onAssistantDelta}
              onMapInstruction={onMapInstruction}
              onToolCall={onToolCall}
              onToolResult={onToolResult}
              onTurnEnd={onTurnEnd}
              streaming={streaming}
              setStreaming={setStreaming}
              triggerDirective={triggerDirective}
              scenarioId={scenarioId}
              onTriggerConsumed={() => setTriggerDirective(null)}
              toolActivity={toolActivity}
            />
          )}

          {rightTab === "drill" && activeCategory && (
            <DrillPanel
              category={activeCategory}
              assets={drillRows}
              onSelect={flyToAsset}
              highlightId={highlightId}
              emptyLabel={drillEmpty}
            />
          )}
          {rightTab === "drill" && !activeCategory && (
            <AllAssetsAccordion
              assetsByCategory={FULL_BY_CATEGORY}
              footprintIdsByCategory={footprintIdsByCategory}
              onSelect={flyToAsset}
              highlightId={highlightId}
              resetSignal={accordionResetSignal}
            />
          )}
        </div>
      </div>

      {topTracts.length > 0 && rightTab === "drill" && activeCategory && (
        <div className="border-t border-arc-gray-100 dark:border-arc-gray-700 bg-arc-cream/60 dark:bg-arc-black/40 px-4 py-2 text-[10px] font-data uppercase tracking-wider text-arc-gray-500 dark:text-arc-gray-300">
          Top vulnerable tracts:{" "}
          {topTracts
            .slice(0, 3)
            .map(
              (t) =>
                `${t.name} (${((t.rpl_themes ?? 0) * 100).toFixed(0)}%)`,
            )
            .join(" · ")}
        </div>
      )}

      <footer className="border-t border-arc-gray-100 dark:border-arc-gray-700 px-4 py-2 text-[10px] text-arc-gray-500 dark:text-arc-gray-300 font-data uppercase tracking-wider flex items-center justify-between">
        <span>
          CDC SVI · FEMA NRI · ALICE · OpenFEMA · TIGERweb · FL Parcels ·
          Pinellas Assets
        </span>
        <span>
          Sibling of{" "}
          <a
            href="https://github.com/franzenjb/cascade-demo"
            className="underline hover:text-arc-maroon"
          >
            cascade-demo
          </a>{" "}
          &amp;{" "}
          <a href="https://ops.jbf.com" className="underline hover:text-arc-maroon">
            ops.jbf.com
          </a>
        </span>
      </footer>
    </main>
  );
}

function prettyToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[9px] font-data uppercase tracking-widest text-white/60">
        {label}
      </span>
      <span className="text-sm font-data font-semibold">{value}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col leading-tight min-w-[110px]">
      <span className="text-[9px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-arc-gray-300">
        {label}
      </span>
      <span
        className={`text-lg font-headline font-bold ${
          warn ? "text-arc-red" : "text-arc-black dark:text-arc-cream"
        }`}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[10px] font-data text-arc-gray-500 dark:text-arc-gray-300">
          {sub}
        </span>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-data uppercase tracking-wider border transition-colors whitespace-nowrap ${
        active
          ? "bg-arc-black text-white border-arc-black dark:bg-arc-cream dark:text-arc-black dark:border-arc-cream"
          : "bg-white dark:bg-arc-gray-900 text-arc-gray-900 dark:text-arc-cream border-arc-gray-300 dark:border-arc-gray-700 hover:border-arc-black dark:hover:border-arc-cream"
      }`}
    >
      <span>{label}</span>
      <span
        className={`font-semibold ${
          active ? "opacity-80" : "text-arc-maroon"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-xs font-data uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
        active
          ? "border-arc-red text-arc-maroon dark:text-arc-cream"
          : disabled
          ? "border-transparent text-arc-gray-300 dark:text-arc-gray-700 cursor-not-allowed"
          : "border-transparent text-arc-gray-500 dark:text-arc-gray-300 hover:text-arc-maroon"
      }`}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          className={`text-[10px] font-semibold px-1.5 rounded ${
            active
              ? "bg-arc-red text-white"
              : "bg-arc-gray-100 dark:bg-arc-gray-700 text-arc-gray-500 dark:text-arc-gray-300"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
