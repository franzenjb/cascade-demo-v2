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
import { AssetIcon } from "@/components/AssetIcons";
import {
  ASSET_TYPES,
  type AssetLayerVisibility,
  type AssetType,
} from "@/components/MapView";

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

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instructions, setInstructions] = useState<MapInstruction[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [triggerDirective, setTriggerDirective] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [clearSignal, setClearSignal] = useState(0);
  const [focusTarget, setFocusTarget] = useState<
    { center: [number, number]; zoom: number } | null
  >(null);
  const [assetVisibility, setAssetVisibility] =
    useState<AssetLayerVisibility>(DEFAULT_VISIBILITY);
  const [activeWarning, setActiveWarning] = useState<ActiveWarning | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  // Tool-result-driven structured state
  const [assetsByCategory, setAssetsByCategory] = useState<
    Partial<Record<AssetType, DrillAsset[]>>
  >({});
  const [metrics, setMetrics] = useState<SituationMetrics | null>(null);
  const [topTracts, setTopTracts] = useState<TractHit[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("conversation");
  const [activeCategory, setActiveCategory] = useState<AssetType | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [streamTick, setStreamTick] = useState(0);

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
      setAssetsByCategory(grouped);
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
      const topVuln = hits.filter(
        (h) => (h.rpl_themes ?? 0) >= 0.9
      ).length;
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
    setAssetsByCategory({});
    setMetrics(null);
    setTopTracts([]);
    setActiveCategory(null);
    setHighlightId(null);
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

  const drillCounts = useMemo(() => {
    const counts: Partial<Record<AssetType, number>> = {};
    for (const t of ASSET_TYPES) {
      counts[t.key] = assetsByCategory[t.key]?.length ?? 0;
    }
    return counts;
  }, [assetsByCategory]);

  const totalAssetRows = useMemo(
    () => Object.values(drillCounts).reduce((s, n) => s + (n ?? 0), 0),
    [drillCounts]
  );

  // After the stream finishes, if assets landed, flip to the assets tab.
  // Uses a post-render effect so React has flushed all setState calls from
  // the stream loop — onTurnEnd running inside a sync finally block can't
  // see the latest assetsByCategory via closure.
  useEffect(() => {
    if (streamTick === 0) return;
    if (totalAssetRows > 0 && rightTab === "conversation") {
      setRightTab("drill");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamTick]);

  const activeCategoryLabel = activeCategory
    ? ASSET_TYPES.find((t) => t.key === activeCategory)?.label || "Assets"
    : "Assets";

  const assetTabCount =
    activeCategory != null ? drillCounts[activeCategory] ?? 0 : totalAssetRows;

  const flyToAsset = (a: DrillAsset) => {
    setHighlightId(a.id);
    setFocusTarget({ center: [a.lon, a.lat], zoom: 14 });
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

      {totalAssetRows > 0 && (
        <div className="border-b border-arc-gray-100 dark:border-arc-gray-700 bg-arc-cream/60 dark:bg-arc-black/40 px-4 py-2 flex gap-2 overflow-x-auto">
          {ASSET_TYPES.map((t) => {
            const count = drillCounts[t.key] ?? 0;
            if (count === 0) return null;
            const active = activeCategory === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setActiveCategory(t.key);
                  setRightTab("drill");
                }}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-data uppercase tracking-wider border transition-colors ${
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
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-0">
        <div className="min-h-[50vh] lg:min-h-0 relative">
          <MapView
            center={CENTER}
            zoom={ZOOM}
            instructions={instructions}
            clearSignal={clearSignal}
            focusTarget={focusTarget}
            assetVisibility={assetVisibility}
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
            {totalAssetRows > 0 && (
              <TabButton
                active={rightTab === "drill"}
                onClick={() => setRightTab("drill")}
                label={activeCategoryLabel}
                count={assetTabCount}
              />
            )}
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
              assets={assetsByCategory[activeCategory] ?? []}
              onSelect={flyToAsset}
              highlightId={highlightId}
            />
          )}
          {rightTab === "drill" && !activeCategory && (
            <div className="flex-1 flex items-center justify-center text-xs text-arc-gray-500 italic p-4 text-center">
              Pick a category chip above to drill into named landmarks.
            </div>
          )}
        </div>
      </div>

      {topTracts.length > 0 && rightTab === "drill" && activeCategory && (
        <div className="border-t border-arc-gray-100 dark:border-arc-gray-700 bg-arc-cream/60 dark:bg-arc-black/40 px-4 py-2 text-[10px] font-data uppercase tracking-wider text-arc-gray-500 dark:text-arc-gray-300">
          Top vulnerable tracts: {topTracts.slice(0, 3).map((t) => `${t.name} (${((t.rpl_themes ?? 0) * 100).toFixed(0)}%)`).join(" · ")}
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
          warn
            ? "text-arc-red"
            : "text-arc-black dark:text-arc-cream"
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
