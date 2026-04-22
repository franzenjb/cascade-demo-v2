"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessage,
  GeoJSONPolygon,
  MapInstruction,
} from "@/lib/types";
import ChatPanel from "@/components/ChatPanel";
import TriggerButton from "@/components/TriggerButton";
import DrillPanel, { type DrillAsset } from "@/components/DrillPanel";
import AllAssetsAccordion from "@/components/AllAssetsAccordion";
import DetailsPanel from "@/components/DetailsPanel";
import BriefingCard from "@/components/BriefingCard";
import { AssetIcon } from "@/components/AssetIcons";
import {
  ASSET_TYPES,
  type AssetLayerVisibility,
  type AssetType,
  type FocusTarget,
} from "@/components/MapView";
import type { RiskFilter } from "@/lib/types";
import ToastContainer from "@/components/Toast";
import { ToastProvider, useToast } from "@/lib/use-toast";
import type { TractPopupProps } from "@/lib/tract-popup";
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

/** Ray-casting point-in-polygon (works on the outer ring of a GeoJSON Polygon). */
function pointInPolygon(
  lng: number,
  lat: number,
  ring: number[][],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

type BBox = [[number, number], [number, number]];

function boundsForInstructions(
  instrs: MapInstruction[],
): BBox | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (
      coords.length >= 2 &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      const lng = coords[0] as number;
      const lat = coords[1] as number;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const c of coords) walk(c);
  };
  for (const inst of instrs) {
    if (inst.action !== "draw" || !inst.geometry) continue;
    const g = inst.geometry as unknown as {
      type?: string;
      coordinates?: unknown;
      features?: Array<{ geometry?: { coordinates?: unknown } }>;
    };
    if (g.type === "FeatureCollection" && g.features) {
      for (const f of g.features) walk(f.geometry?.coordinates);
    } else {
      walk(g.coordinates);
    }
  }
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
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

type RightTab = "briefing" | "assets" | "details";
type DrillScope = "footprint" | "all";

export default function Page() {
  return (
    <ToastProvider>
      <PageContent />
      <ToastContainer />
    </ToastProvider>
  );
}

function PageContent() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instructions, setInstructions] = useState<MapInstruction[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [triggerDirective, setTriggerDirective] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [pendingBriefing, setPendingBriefing] = useState(false);
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
  const [rightTab, setRightTab] = useState<RightTab>("briefing");
  const [activeCategory, setActiveCategory] = useState<AssetType | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [drillScope, setDrillScope] = useState<DrillScope>("all");
  const [accordionResetSignal, setAccordionResetSignal] = useState(0);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [streamTick, setStreamTick] = useState(0);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>({
    mode: "combined",
    sviMin: 60,
    nriMin: 60,
  });
  const [tracts, setTracts] = useState<TractPopupProps[]>([]);
  const [selectedTract, setSelectedTract] = useState<TractPopupProps | null>(
    null,
  );
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const hasFootprint = totalFootprint > 0;

  useEffect(() => {
    if (!activeWarning) {
      setCountdown(null);
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
      return;
    }
    const tick = () => {
      const diffMs = new Date(activeWarning.expires).getTime() - Date.now();
      if (diffMs <= 0) {
        setCountdown("EXPIRED");
        if (!expiryTimerRef.current) {
          expiryTimerRef.current = setTimeout(() => {
            setActiveWarning(null);
            expiryTimerRef.current = null;
          }, 5000);
        }
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

  /** Fire the briefing API silently — tool results populate metrics, no chat UI. */
  const runBackgroundBriefing = async (directive: string, sid: string) => {
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [],
          message: "Produce the proactive situational briefing.",
          trigger_directive: directive,
          scenario_id: sid,
        }),
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data:\s?/, "");
          if (!line || line === "[DONE]") continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "tool_call" && evt.toolName) {
              onToolCall(evt.toolName);
            } else if (evt.type === "tool_result" && evt.toolName && evt.toolResult) {
              try {
                const parsed = JSON.parse(evt.toolResult);
                if (parsed && typeof parsed === "object") {
                  onToolResult(evt.toolName, parsed as Record<string, unknown>);
                }
              } catch { /* non-JSON */ }
            } else if (evt.type === "map_instruction" && evt.mapInstruction) {
              onMapInstruction(evt.mapInstruction);
            }
            // Ignore text deltas — BriefingCard shows the data directly
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(msg, "error");
    } finally {
      setStreaming(false);
      onTurnEnd();
    }
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
    setMetrics(null);
    setTopTracts([]);
    setSelectedTract(null);
    setActiveCategory(null);
    setHighlightId(null);
    setDrillScope("footprint");
    setStreamTick(0);
    setRightTab("briefing");
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
    setTriggerDirective(payload.directive);
    setPendingBriefing(false);
    setScenarioId(payload.scenarioId);

    // Fire the briefing API call silently — no user message bubble
    runBackgroundBriefing(payload.directive, payload.scenarioId);
    setActiveWarning({
      nwsEventId: payload.nwsEventId,
      expires: payload.expires,
      scenarioId: payload.scenarioId,
    });

    // Filter assets to those inside the warning polygon
    const poly = payload.polygon as { type: string; coordinates: number[][][] };
    const ring = poly?.coordinates?.[0];
    if (ring) {
      const inside = FULL_ASSETS.filter((a) => pointInPolygon(a.lon, a.lat, ring));
      const grouped: Partial<Record<AssetType, DrillAsset[]>> = {};
      for (const a of inside) {
        const k = a.type as AssetType;
        (grouped[k] ||= []).push(a);
      }
      setFootprintByCategory(grouped);
    } else {
      setFootprintByCategory({});
    }
  };

  const totalFullAssets = FULL_ASSETS.length;

  const activeCategoryLabel = activeCategory
    ? ASSET_TYPES.find((t) => t.key === activeCategory)?.label || "Assets"
    : "All Landmarks";

  const drillRows: DrillAsset[] = useMemo(() => {
    if (!activeCategory) return [];
    if (hasFootprint)
      return footprintByCategory[activeCategory] ?? [];
    return FULL_BY_CATEGORY[activeCategory] ?? [];
  }, [activeCategory, footprintByCategory, hasFootprint]);

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

  const handleTractClick = (t: TractPopupProps) => {
    setSelectedTract(t);
    setRightTab("details");
    if (t.centroid_lng && t.centroid_lat) {
      setFocusTarget({
        center: [t.centroid_lng, t.centroid_lat],
        zoom: 13,
      });
    }
  };

  const flyToTract = (nameOrGeoid: string) => {
    const short = nameOrGeoid.replace(/^Census Tract\s+/i, "");
    const hit = tracts.find(
      (t) =>
        t.geoid === nameOrGeoid || t.name === nameOrGeoid || t.name === short,
    );
    if (!hit) return;
    handleTractClick(hit);
  };

  const shortTractName = (raw: string) =>
    raw.replace(/^Census Tract\s+/i, "");


  const handleAssetClick = (a: DrillAsset) => {
    const cat = a.type as AssetType;
    setActiveCategory(cat);
    setHighlightId(a.id);
    setRightTab("assets");
    setFocusTarget({ center: [a.lon, a.lat], zoom: 14 });
  };

  const focusWholeView = () => {
    const warnB = boundsForInstructions(instructions);
    if (warnB) {
      setFocusTarget({ bounds: warnB, padding: 80, maxZoom: 13 });
    } else {
      setFocusTarget({ center: CENTER, zoom: ZOOM });
    }
  };

  const handleAllChip = () => {
    setActiveCategory(null);
    setHighlightId(null);
    setRightTab("assets");
    setAccordionResetSignal((n) => n + 1);
    focusWholeView();
    setAssetVisibility(allOn());
  };

  const handleTypeChip = (cat: AssetType) => {
    setActiveCategory(cat);
    setRightTab("assets");
    setHighlightId(null);
    focusWholeView();
    setAssetVisibility(onlyThis(cat));
  };

  const copyBriefing = async () => {
    const last = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.trim());
    if (!last) {
      toast("No briefing to copy", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(last.content);
      toast("Briefing copied to clipboard", "success");
    } catch {
      toast("Copy failed — try selecting the text manually", "error");
    }
  };

  const printBriefing = () => {
    window.print();
  };

  const handlePillClick = (question: string) => {
    // Feed the question into the chat system
    const userMsg: ChatMessage = { role: "user", content: question };
    onUserMessage(userMsg);
    // Trigger the ChatPanel's streaming logic by setting pendingBriefing-like state
    // Actually, we need to use the same mechanism as ChatPanel's submit
    // So we'll switch to showing the chat with this question pre-loaded
    setRightTab("briefing");
  };

  return (
    <main className="h-screen flex flex-col bg-arc-cream dark:bg-arc-black">
      {/* Auto-show trigger modal on load — no button in header */}
      {!activeWarning && (
        <TriggerButton onFired={handleTriggerFired} autoShow />
      )}
      {/* Top bar — identity + alert status. */}
      <header className="bg-arc-maroon text-white shadow-md no-print">
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
                Pinellas County · FL
              </p>
            </div>
          </div>
          {!activeWarning && (
            <div className="hidden sm:flex items-center gap-4 text-xs font-data uppercase tracking-wider text-white/90 font-semibold">
              <span><span className="tabular-nums">959,107</span> pop</span>
              <span><span className="tabular-nums">245</span> tracts</span>
              <span><span className="tabular-nums">36</span> FEMA decl</span>
              <span><span className="tabular-nums">25.2%</span> ALICE <span className="font-normal text-white/70">(241,695 households)</span></span>
            </div>
          )}
          <div className="flex items-center gap-3">
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
          </div>
        </div>
        <div className="h-[2px] bg-arc-red" />
      </header>


      <div className="chip-bar border-b border-arc-gray-100 dark:border-arc-gray-700 bg-arc-cream/60 dark:bg-arc-black/40 px-4 py-2 flex gap-2 overflow-x-auto items-center">
        <Chip
          active={activeCategory === null}
          onClick={handleAllChip}
          label="All"
          count={hasFootprint ? totalFootprint : totalFullAssets}
        />
        {ASSET_TYPES.map((t) => {
          const count = hasFootprint
            ? footprintCounts[t.key] ?? 0
            : fullCounts[t.key] ?? 0;
          if (count === 0) return null;
          const active = activeCategory === t.key;
          const showFootprint = hasFootprint;
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
      </div>


      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-0">
        <div className="map-area min-h-[50vh] lg:min-h-0 relative">
          <MapView
            center={CENTER}
            zoom={ZOOM}
            instructions={instructions}
            clearSignal={clearSignal}
            focusTarget={focusTarget}
            assetVisibility={assetVisibility}
            onAssetClick={handleAssetClick}
            riskFilter={riskFilter}
            onTractsLoaded={setTracts}
            onTractClick={handleTractClick}
          />
        </div>
        <div className="right-panel border-l border-arc-gray-100 dark:border-arc-gray-700 flex flex-col min-h-0 bg-white dark:bg-arc-gray-900">
          <div className="tab-bar flex items-center border-b border-arc-gray-100 dark:border-arc-gray-700">
            <TabButton
              active={rightTab === "briefing"}
              onClick={() => setRightTab("briefing")}
              label="Briefing"
              count={messages.filter((m) => m.role === "assistant").length}
            />
            <TabButton
              active={rightTab === "assets"}
              onClick={() => setRightTab("assets")}
              label="Assets"
              count={assetTabCount}
            />
            <TabButton
              active={rightTab === "details"}
              onClick={() => setRightTab("details")}
              label="Details"
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

          {rightTab === "briefing" && (
            <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
              {activeWarning && metrics ? (
                <>
                  <BriefingCard
                    metrics={metrics}
                    countdown={countdown}
                    footprintByCategory={footprintByCategory}
                    topTracts={topTracts}
                    onTractClick={flyToTract}
                  />
                  <ActionPills onAsk={handlePillClick} />
                </>
              ) : (
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
                  pendingBriefing={pendingBriefing}
                  onBriefingSent={() => setPendingBriefing(false)}
                  onStreamError={(msg) => toast(msg, "error")}
                  toolActivity={toolActivity}
                />
              )}
            </div>
          )}

          {rightTab === "assets" && activeCategory && (
            <DrillPanel
              category={activeCategory}
              assets={drillRows}
              onSelect={flyToAsset}
              highlightId={highlightId}
              emptyLabel={drillEmpty}
            />
          )}
          {rightTab === "assets" && !activeCategory && (
            <AllAssetsAccordion
              assetsByCategory={hasFootprint ? footprintByCategory : FULL_BY_CATEGORY}
              footprintIdsByCategory={footprintIdsByCategory}
              onSelect={flyToAsset}
              highlightId={highlightId}
              resetSignal={accordionResetSignal}
            />
          )}
          {rightTab === "details" && (
            <DetailsPanel
              selectedTract={selectedTract}
              risk={riskFilter}
              onRiskChange={setRiskFilter}
              visibility={assetVisibility}
              onVisibilityChange={setAssetVisibility}
            />
          )}
        </div>
      </div>

      {topTracts.length > 0 && rightTab === "assets" && activeCategory && (
        <div className="border-t border-arc-gray-100 dark:border-arc-gray-700 bg-arc-cream/60 dark:bg-arc-black/40 px-4 py-2 text-[10px] font-data uppercase tracking-wider text-arc-gray-500 dark:text-arc-gray-300">
          Top vulnerable areas:{" "}
          {topTracts
            .slice(0, 3)
            .map((t) => {
              const short = shortTractName(t.name);
              const place = tracts.find(
                (x) => x.geoid === t.geoid || x.name === short,
              )?.place;
              const label = place
                ? `${place} (Tract ${short})`
                : `Tract ${short}`;
              return `${label} · ${((t.rpl_themes ?? 0) * 100).toFixed(0)}%`;
            })
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
            href="https://github.com/franzenjb/cascade1"
            className="underline hover:text-arc-maroon"
          >
            cascade1
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
  count?: number;
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
      {(count ?? 0) > 0 && (
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

const ACTION_PILLS = [
  {
    label: "Nearest Red Cross ERV depots",
    question: "Show me the nearest Red Cross ERV depots to the center of the warning polygon with distances.",
  },
  {
    label: "Full MHP list with unit counts",
    question: "List every mobile home park inside the warning polygon with unit counts and percentage of residents over 65.",
  },
  {
    label: "Shelter-capable schools",
    question: "Which schools in the warning footprint have shelter agreements on file? Show enrollment and capacity.",
  },
  {
    label: "Hospital surge capacity",
    question: "What is the total hospital bed count and ER status for hospitals in the warning polygon?",
  },
  {
    label: "Historical tornado frequency",
    question: "How many tornado-related FEMA declarations has Pinellas County had? What is the historical frequency?",
  },
  {
    label: "Highest-risk tracts deep dive",
    question: "Give me a detailed breakdown of the top 3 most vulnerable tracts in the warning polygon — population, SVI themes, and what makes them high-risk.",
  },
  {
    label: "Evacuation-sensitive populations",
    question: "What populations in the footprint would be hardest to evacuate? Consider mobile homes, elderly concentrations, and areas without vehicle access.",
  },
  {
    label: "Generate leadership briefing",
    question: "Generate a shareable leadership briefing document summarizing the current tornado warning situation.",
  },
];

function ActionPills({ onAsk }: { onAsk: (question: string) => void }) {
  return (
    <div className="px-4 py-4 border-t border-arc-gray-100 dark:border-arc-gray-700">
      <div className="text-[10px] font-data uppercase tracking-widest text-arc-gray-500 dark:text-arc-gray-300 mb-3">
        Ask Cascade
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTION_PILLS.map((pill) => (
          <button
            key={pill.label}
            onClick={() => onAsk(pill.question)}
            className="px-3 py-1.5 text-xs font-data border border-arc-gray-300 dark:border-arc-gray-600 text-arc-black dark:text-arc-cream bg-arc-cream/50 dark:bg-arc-black/30 hover:border-arc-red hover:text-arc-red dark:hover:border-arc-red dark:hover:text-arc-red transition-colors"
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  );
}
