"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import type { MapInstruction } from "@/lib/types";
import assetsJson from "@/data/pinellas_assets.json";
import { assetIconSVG } from "./AssetIcons";
import type { DrillAsset } from "./DrillPanel";
import type { RiskFilter, RiskMode } from "@/lib/types";
import type { TractPopupProps } from "@/lib/tract-popup";
import { STORM_REPORTS } from "@/lib/storm-reports";

const BASEMAPS: { name: string; url: string }[] = [
  { name: "Light", url: "https://tiles.openfreemap.org/styles/positron" },
  { name: "Streets", url: "https://tiles.openfreemap.org/styles/liberty" },
  { name: "Bright", url: "https://tiles.openfreemap.org/styles/bright" },
];

export type AssetType =
  | "red_cross"
  | "school"
  | "fire_station"
  | "police_station"
  | "mobile_home_park"
  | "hospital";

export type AssetLayerVisibility = Record<AssetType, boolean>;

export const ASSET_TYPES: { key: AssetType; label: string; color: string }[] = [
  { key: "red_cross", label: "Red Cross Sites", color: "#ED1B2E" },
  { key: "hospital", label: "Hospitals", color: "#0d9488" },
  { key: "mobile_home_park", label: "Mobile Home Parks", color: "#b45309" },
  { key: "school", label: "Schools", color: "#1d4ed8" },
  { key: "fire_station", label: "Fire Stations", color: "#c2410c" },
  { key: "police_station", label: "Police Stations", color: "#334155" },
];

interface RawAsset {
  id: string;
  type: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  city: string;
  attrs: Record<string, unknown>;
}
const ASSETS = (assetsJson as { assets: RawAsset[] }).assets;

export type FocusTarget =
  | { center: [number, number]; zoom: number }
  | {
      bounds: [[number, number], [number, number]];
      padding?: number;
      maxZoom?: number;
    };

interface Props {
  center: [number, number];
  zoom: number;
  instructions: MapInstruction[];
  clearSignal?: number;
  focusTarget?: FocusTarget | null;
  assetVisibility?: AssetLayerVisibility;
  onAssetClick?: (asset: DrillAsset) => void;
  riskFilter?: RiskFilter;
  onTractsLoaded?: (tracts: TractPopupProps[]) => void;
  onTractClick?: (tract: TractPopupProps) => void;
  /** Number of storm reports to show on the map (drip-fed from crawl) */
  stormReportCount?: number;
}

type TractFC = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, TractPopupProps>;

type PaintExpr = unknown;

function paintForMode(
  mode: RiskMode,
  sviMin: number,
  nriMin: number,
): { color: PaintExpr; opacity: PaintExpr } {
  if (mode === "off") {
    return { color: "#000000", opacity: 0 };
  }
  if (mode === "nri") {
    const v = ["coalesce", ["to-number", ["get", "nri_score"]], -1];
    return {
      color: [
        "step",
        v,
        "#f5e8c6",
        20,
        "#e9c46a",
        40,
        "#e07a3c",
        60,
        "#c0392b",
        80,
        "#5b2b8c",
      ],
      opacity: ["case", ["<", v, 0], 0, ["<", v, nriMin], 0.05, 0.55],
    };
  }
  if (mode === "combined") {
    // Combined = tract must pass BOTH thresholds independently.
    // Coloring still uses combined_pct so the darker tracts are those that
    // are high on both axes. Missing data on an active axis → hide.
    const c = ["coalesce", ["to-number", ["get", "combined_pct"]], -1];
    const svi = [
      "*",
      ["coalesce", ["to-number", ["get", "svi_pct"]], -0.01],
      100,
    ];
    const nri = ["coalesce", ["to-number", ["get", "nri_score"]], -1];
    const opacity: unknown[] = ["case", ["<", c, 0], 0];
    const fails: unknown[] = [];
    if (sviMin > 0) {
      opacity.push(["<", svi, 0], 0);
      fails.push(["<", svi, sviMin]);
    }
    if (nriMin > 0) {
      opacity.push(["<", nri, 0], 0);
      fails.push(["<", nri, nriMin]);
    }
    if (fails.length === 1) opacity.push(fails[0], 0.05);
    else if (fails.length > 1) opacity.push(["any", ...fails], 0.05);
    opacity.push(0.55);
    return {
      color: [
        "step",
        c,
        "#f3e6e6",
        25,
        "#e9b7b7",
        50,
        "#d97373",
        75,
        "#b51a2b",
        90,
        "#7a0f1d",
      ],
      opacity,
    };
  }
  // svi
  const v = ["*", ["coalesce", ["to-number", ["get", "svi_pct"]], -0.01], 100];
  return {
    color: [
      "step",
      v,
      "#f3e6e6",
      25,
      "#e9b7b7",
      50,
      "#d97373",
      75,
      "#b51a2b",
      90,
      "#7a0f1d",
    ],
    opacity: ["case", ["<", v, 0], 0, ["<", v, sviMin], 0.05, 0.6],
  };
}

export default function MapView({
  center,
  zoom,
  instructions,
  clearSignal,
  focusTarget,
  assetVisibility,
  onAssetClick,
  riskFilter,
  onTractsLoaded,
  onTractClick,
  stormReportCount = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const drawnCountRef = useRef(0);
  const appliedCountRef = useRef(0);
  const assetLayersInitRef = useRef(false);
  const initAssetLayersRef = useRef<(() => Promise<void>) | null>(null);
  const tractsDataRef = useRef<TractFC | null>(null);
  const tractLayerInitRef = useRef(false);
  const initTractLayerRef = useRef<(() => void) | null>(null);
  const instructionsRef = useRef<MapInstruction[]>([]);
  const onAssetClickRef = useRef<typeof onAssetClick>(undefined);
  const onTractsLoadedRef = useRef<typeof onTractsLoaded>(undefined);
  const onTractClickRef = useRef<typeof onTractClick>(undefined);
  const [basemapIdx, setBasemapIdx] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  instructionsRef.current = instructions;
  onAssetClickRef.current = onAssetClick;
  onTractsLoadedRef.current = onTractsLoaded;
  onTractClickRef.current = onTractClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[0].url,
      center,
      zoom,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    const loadIconImage = (key: AssetType, color: string): Promise<void> =>
      new Promise((resolve) => {
        const imageName = `cascade-asset-icon-${key}`;
        if (map.hasImage(imageName)) return resolve();
        const svg = assetIconSVG(key, color, 48);
        const img = new Image(48, 48);
        img.onload = () => {
          if (!map.hasImage(imageName)) {
            map.addImage(imageName, img, { pixelRatio: 2 });
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      });

    const initAssetLayers = async () => {
      if (assetLayersInitRef.current) return;
      assetLayersInitRef.current = true;

      await Promise.all(
        ASSET_TYPES.map(({ key, color }) => loadIconImage(key, color)),
      );

      for (const { key } of ASSET_TYPES) {
        const subset = ASSETS.filter((a) => a.type === key);
        const fc: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: subset.map((a) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [a.lon, a.lat] },
            properties: {
              id: a.id,
              name: a.name,
              address: a.address,
              city: a.city,
            },
          })),
        };
        const sourceId = `cascade-asset-${key}`;
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: "geojson", data: fc });
        }
        if (!map.getLayer(`${sourceId}-symbol`)) {
          map.addLayer({
            id: `${sourceId}-symbol`,
            type: "symbol",
            source: sourceId,
            layout: {
              "icon-image": `cascade-asset-icon-${key}`,
              "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                0.55,
                11,
                0.85,
                14,
                1.3,
              ],
              "icon-allow-overlap": true,
              "icon-anchor": "center",
              visibility: "visible",
            },
          });
        }
        if (!map.getLayer(`${sourceId}-label`)) {
          map.addLayer({
            id: `${sourceId}-label`,
            type: "symbol",
            source: sourceId,
            minzoom: 12,
            layout: {
              "text-field": ["get", "name"],
              "text-size": 11,
              "text-offset": [0, 1.4],
              "text-anchor": "top",
              "text-allow-overlap": false,
              visibility: "visible",
            },
            paint: {
              "text-color": "#1f2937",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.4,
            },
          });
        }
      }

      for (const { key } of ASSET_TYPES) {
        map.on("click", `cascade-asset-${key}-symbol`, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties || {};
          const raw = ASSETS.find((a) => a.id === p.id);
          if (!raw) return;
          onAssetClickRef.current?.({
            id: raw.id,
            type: raw.type,
            name: raw.name,
            lat: raw.lat,
            lon: raw.lon,
            address: raw.address,
            city: raw.city,
            attrs: raw.attrs,
          });
        });
        map.on("mouseenter", `cascade-asset-${key}-symbol`, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", `cascade-asset-${key}-symbol`, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    };

    initAssetLayersRef.current = initAssetLayers;

    const initTractLayer = () => {
      if (tractLayerInitRef.current) return;
      if (!tractsDataRef.current) return;
      tractLayerInitRef.current = true;

      const firstAssetSymbol = map
        .getStyle()
        .layers?.find(
          (l) => l.type === "symbol" && l.id.startsWith("cascade-asset-"),
        )?.id;

      if (!map.getSource("cascade-tracts")) {
        map.addSource("cascade-tracts", {
          type: "geojson",
          data: tractsDataRef.current,
        });
      }
      if (!map.getLayer("cascade-tract-fill")) {
        map.addLayer(
          {
            id: "cascade-tract-fill",
            type: "fill",
            source: "cascade-tracts",
            paint: {
              "fill-color": "#7a0f1d",
              "fill-opacity": 0,
            },
          },
          firstAssetSymbol,
        );
      }
      if (!map.getLayer("cascade-tract-line")) {
        map.addLayer(
          {
            id: "cascade-tract-line",
            type: "line",
            source: "cascade-tracts",
            paint: {
              "line-color": "#6b7280",
              "line-width": 0.4,
              "line-opacity": 0.5,
            },
          },
          firstAssetSymbol,
        );
      }

      map.on("click", "cascade-tract-fill", (e) => {
        // Asset symbols always win — if any asset is under the cursor, let
        // its own click handler fire and bail out here.
        const assetLayerIds = ASSET_TYPES.map(
          (t) => `cascade-asset-${t.key}-symbol`,
        ).filter((id) => map.getLayer(id));
        if (assetLayerIds.length) {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: assetLayerIds,
          });
          if (hits.length > 0) return;
        }
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as unknown as TractPopupProps;
        if (!p || !p.geoid) return;
        onTractClickRef.current?.(p);
      });
      map.on("mouseenter", "cascade-tract-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "cascade-tract-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    };

    initTractLayerRef.current = initTractLayer;

    const bootstrap = async () => {
      await initAssetLayers();
      // Fetch tracts once; layer is gated on data arriving.
      if (!tractsDataRef.current) {
        try {
          const res = await fetch("/api/tracts");
          if (res.ok) {
            const data = (await res.json()) as TractFC;
            tractsDataRef.current = data;
            const props = data.features.map((f) => f.properties);
            onTractsLoadedRef.current?.(props);
          }
        } catch {
          // non-fatal
        }
      }
      initTractLayer();
    };

    if (map.isStyleLoaded()) bootstrap();
    else map.on("load", bootstrap);

    return () => {
      map.remove();
      mapRef.current = null;
      assetLayersInitRef.current = false;
      initAssetLayersRef.current = null;
      tractLayerInitRef.current = false;
      initTractLayerRef.current = null;
    };
  }, [center, zoom]);

  const currentStyleUrlRef = useRef<string>(BASEMAPS[0].url);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const url = BASEMAPS[basemapIdx].url;
    if (currentStyleUrlRef.current === url) return;
    currentStyleUrlRef.current = url;
    map.setStyle(url);
    map.once("style.load", async () => {
      assetLayersInitRef.current = false;
      tractLayerInitRef.current = false;
      stormLayersInitRef.current = false;
      drawnCountRef.current = 0;
      appliedCountRef.current = 0;
      await initAssetLayersRef.current?.();
      initTractLayerRef.current?.();
      const pending = instructionsRef.current;
      appliedCountRef.current = pending.length;
      for (const inst of pending) replayInstruction(map, inst, drawnCountRef);
      // Re-add storm layers on top after basemap switch
      setupStormLayers(map);
      updateStormData(map, stormReportCount);
    });
  }, [basemapIdx]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !riskFilter) return;
    const apply = () => {
      if (!map.getLayer("cascade-tract-fill")) return;
      const { color, opacity } = paintForMode(
        riskFilter.mode,
        riskFilter.sviMin,
        riskFilter.nriMin,
      );
      map.setPaintProperty(
        "cascade-tract-fill",
        "fill-color",
        color as never,
      );
      map.setPaintProperty(
        "cascade-tract-fill",
        "fill-opacity",
        opacity as never,
      );
      map.setPaintProperty(
        "cascade-tract-line",
        "line-opacity",
        riskFilter.mode === "off" ? 0.2 : 0.5,
      );
    };
    if (map.isStyleLoaded() && map.getLayer("cascade-tract-fill")) apply();
    else {
      const handler = () => {
        if (map.getLayer("cascade-tract-fill")) {
          apply();
          map.off("idle", handler);
        }
      };
      map.on("idle", handler);
    }
  }, [riskFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !assetVisibility) return;
    const apply = () => {
      for (const { key } of ASSET_TYPES) {
        const vis = assetVisibility[key] ? "visible" : "none";
        if (map.getLayer(`cascade-asset-${key}-symbol`)) {
          map.setLayoutProperty(`cascade-asset-${key}-symbol`, "visibility", vis);
        }
        if (map.getLayer(`cascade-asset-${key}-label`)) {
          map.setLayoutProperty(`cascade-asset-${key}-label`, "visibility", vis);
        }
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [assetVisibility]);

  useEffect(() => {
    if (clearSignal === undefined) return;
    const map = mapRef.current;
    if (!map) return;
    const wipe = () => {
      const toRemove: string[] = [];
      map.getStyle().layers?.forEach((l) => {
        if (l.id.startsWith("cascade-draw-")) toRemove.push(l.id);
      });
      toRemove.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      const sources = Object.keys((map.getStyle().sources || {})).filter((s) =>
        s.startsWith("cascade-draw-"),
      );
      sources.forEach((s) => {
        if (map.getSource(s)) map.removeSource(s);
      });
      drawnCountRef.current = 0;
      appliedCountRef.current = 0;
    };
    if (map.isStyleLoaded()) wipe();
    else map.once("load", wipe);
  }, [clearSignal]);

  useEffect(() => {
    if (!focusTarget) return;
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      if ("bounds" in focusTarget) {
        map.fitBounds(focusTarget.bounds, {
          padding: focusTarget.padding ?? 60,
          maxZoom: focusTarget.maxZoom ?? 13,
          duration: 800,
          essential: true,
        });
      } else {
        map.flyTo({
          center: focusTarget.center,
          zoom: focusTarget.zoom,
          essential: true,
        });
      }
    };
    if (map.isStyleLoaded()) run();
    else map.once("load", run);
  }, [focusTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const pending = instructions.slice(appliedCountRef.current);
      appliedCountRef.current = instructions.length;
      for (const inst of pending) replayInstruction(map, inst, drawnCountRef);
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [instructions]);

  // Storm track — native MapLibre layers (no HTML markers)
  const stormLayersInitRef = useRef(false);

  const setupStormLayers = (map: MlMap) => {
    // Sources
    if (!map.getSource("storm-track-line")) {
      map.addSource("storm-track-line", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getSource("storm-track-points")) {
      map.addSource("storm-track-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    // Remove existing layers so we can re-add on top
    const stormIds = [
      "storm-track-letter",
      "storm-track-dot",
      "storm-track-glow",
      "storm-track-line-layer",
      "storm-track-line-glow",
    ];
    for (const id of stormIds) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    // Line glow
    map.addLayer({
      id: "storm-track-line-glow",
      type: "line",
      source: "storm-track-line",
      paint: { "line-color": "#fbbf24", "line-width": 24, "line-opacity": 0.6, "line-blur": 6 },
    });
    // Line
    map.addLayer({
      id: "storm-track-line-layer",
      type: "line",
      source: "storm-track-line",
      paint: { "line-color": "#dc2626", "line-width": 6, "line-opacity": 1 },
    });
    // Point glow — animated in rAF
    map.addLayer({
      id: "storm-track-glow",
      type: "circle",
      source: "storm-track-points",
      paint: { "circle-radius": 40, "circle-color": "#fbbf24", "circle-opacity": 0.6, "circle-blur": 1 },
    });
    // Point dot
    map.addLayer({
      id: "storm-track-dot",
      type: "circle",
      source: "storm-track-points",
      paint: {
        "circle-radius": 16,
        "circle-color": "#dc2626",
        "circle-stroke-width": 4,
        "circle-stroke-color": "#fbbf24",
      },
    });
    // Letter label
    map.addLayer({
      id: "storm-track-letter",
      type: "symbol",
      source: "storm-track-points",
      layout: {
        "text-field": ["get", "letter"],
        "text-size": 16,
        "text-font": ["Noto Sans Bold"],
        "text-allow-overlap": true,
        "icon-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff", "text-halo-color": "#000000", "text-halo-width": 2 },
    });
    stormLayersInitRef.current = true;
  };

  const updateStormData = (map: MlMap, count: number) => {
    const visible = STORM_REPORTS.slice(0, count);
    const ptSrc = map.getSource("storm-track-points") as maplibregl.GeoJSONSource | undefined;
    if (ptSrc) {
      ptSrc.setData({
        type: "FeatureCollection",
        features: visible.map((r) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] },
          properties: { letter: r.letter, time: r.time, source: r.source, label: r.label },
        })),
      });
    }
    const lineSrc = map.getSource("storm-track-line") as maplibregl.GeoJSONSource | undefined;
    if (lineSrc) {
      lineSrc.setData({
        type: "FeatureCollection",
        features:
          visible.length >= 2
            ? [{
                type: "Feature" as const,
                geometry: { type: "LineString" as const, coordinates: visible.map((r) => [r.lon, r.lat]) },
                properties: {},
              }]
            : [],
      });
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      stormLayersInitRef.current = false;
      setupStormLayers(map);
      updateStormData(map, stormReportCount);
    };
    if (map.isStyleLoaded()) run();
    else map.once("idle", run);
  }, [stormReportCount]);

  // Pulse animation via requestAnimationFrame + z-order enforcement
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let animId: number;
    let lastZCheck = 0;
    const stormTopOrder = [
      "storm-track-line-glow",
      "storm-track-line-layer",
      "storm-track-glow",
      "storm-track-dot",
      "storm-track-letter",
    ];
    const animate = () => {
      const now = performance.now();
      if (map.getLayer("storm-track-glow")) {
        const t = now / 1000;
        map.setPaintProperty("storm-track-glow", "circle-opacity", 0.4 + 0.35 * Math.sin(t * 3));
        map.setPaintProperty("storm-track-glow", "circle-radius", 30 + 15 * Math.sin(t * 3));
      }
      // Re-assert z-order every 2 seconds (asset layers load async)
      if (now - lastZCheck > 2000) {
        lastZCheck = now;
        for (const id of stormTopOrder) {
          if (map.getLayer(id)) map.moveLayer(id);
        }
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="map-container" />
      {pickerOpen && (
        <div
          data-basemap-picker
          className="absolute bottom-20 right-3 z-30 bg-black/90 backdrop-blur rounded-lg overflow-hidden min-w-[140px] shadow-xl"
        >
          {BASEMAPS.map((bm, i) => {
            const isActive = i === basemapIdx;
            return (
              <button
                key={bm.url}
                type="button"
                onClick={() => {
                  setBasemapIdx(i);
                  setPickerOpen(false);
                }}
                className={`block w-full text-left text-xs py-2.5 px-4 border-b border-white/10 last:border-b-0 transition-colors ${
                  isActive
                    ? "bg-arc-red/25 text-white font-bold"
                    : "text-white/70 font-normal hover:bg-white/5"
                }`}
              >
                {bm.name}
              </button>
            );
          })}
        </div>
      )}
      <button
        data-basemap-picker
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        title="Change basemap"
        className="absolute bottom-8 right-3 z-20 w-9 h-9 rounded-lg bg-black/85 backdrop-blur flex items-center justify-center shadow-lg hover:bg-black/95 transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </button>
    </div>
  );
}

function replayInstruction(
  map: MlMap,
  inst: MapInstruction,
  drawnCountRef?: React.MutableRefObject<number>,
) {
  if (inst.action === "clear") {
    const toRemoveLayers: string[] = [];
    map.getStyle().layers?.forEach((l) => {
      if (l.id.startsWith("cascade-draw-")) toRemoveLayers.push(l.id);
    });
    toRemoveLayers.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    const sources = Object.keys(map.getStyle().sources || {}).filter((s) =>
      s.startsWith("cascade-draw-"),
    );
    sources.forEach((s) => {
      if (map.getSource(s)) map.removeSource(s);
    });
    if (drawnCountRef) drawnCountRef.current = 0;
    return;
  }

  if (inst.action !== "draw" || !inst.geometry) return;

  const countObj = drawnCountRef ?? { current: 0 };
  const id = `cascade-draw-${countObj.current++}`;
  // Dedup if this layer id already exists (e.g. replay collision).
  if (map.getSource(id)) return;
  const geom = inst.geometry as unknown as
    | GeoJSON.Geometry
    | GeoJSON.FeatureCollection;
  const data: GeoJSON.FeatureCollection =
    (geom as GeoJSON.FeatureCollection).type === "FeatureCollection"
      ? (geom as GeoJSON.FeatureCollection)
      : {
          type: "FeatureCollection",
          features: [
            { type: "Feature", geometry: geom as GeoJSON.Geometry, properties: {} },
          ],
        };
  map.addSource(id, { type: "geojson", data });
  const color = inst.style?.color || "#ED1B2E";
  const opacity = inst.style?.opacity ?? 0.35;
  const lineWidth = inst.style?.lineWidth ?? 2;
  const lineOpacity = inst.style?.lineOpacity ?? 0.9;
  const firstSymbol = map
    .getStyle()
    .layers?.find(
      (l) => l.type === "symbol" && l.id.startsWith("cascade-asset-"),
    )?.id;
  map.addLayer(
    {
      id: `${id}-fill`,
      type: "fill",
      source: id,
      paint: { "fill-color": color, "fill-opacity": opacity },
      filter: ["==", ["geometry-type"], "Polygon"],
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: `${id}-line`,
      type: "line",
      source: id,
      paint: {
        "line-color": color,
        "line-width": lineWidth,
        "line-opacity": lineOpacity,
      },
      filter: ["in", ["geometry-type"], ["literal", ["Polygon", "LineString"]]],
    },
    firstSymbol,
  );
  map.addLayer({
    id: `${id}-point`,
    type: "circle",
    source: id,
    paint: {
      "circle-color": color,
      "circle-radius": 6,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
    },
    filter: ["==", ["geometry-type"], "Point"],
  });
}
