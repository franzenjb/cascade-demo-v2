"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import type { MapInstruction } from "@/lib/types";
import assetsJson from "@/data/pinellas_assets.json";
import { assetIconSVG } from "./AssetIcons";

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

interface Props {
  center: [number, number];
  zoom: number;
  instructions: MapInstruction[];
  clearSignal?: number;
  focusTarget?: { center: [number, number]; zoom: number } | null;
  assetVisibility?: AssetLayerVisibility;
}

export default function MapView({
  center,
  zoom,
  instructions,
  clearSignal,
  focusTarget,
  assetVisibility,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const drawnCountRef = useRef(0);
  const appliedCountRef = useRef(0);
  const assetLayersInitRef = useRef(false);
  const initAssetLayersRef = useRef<(() => Promise<void>) | null>(null);
  const instructionsRef = useRef<MapInstruction[]>([]);
  const [basemapIdx, setBasemapIdx] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  instructionsRef.current = instructions;

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
                0.28,
                11,
                0.45,
                14,
                0.7,
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
          const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [
            number,
            number,
          ];
          const typeLabel = ASSET_TYPES.find((t) => t.key === key)?.label || key;
          new maplibregl.Popup({ closeButton: true })
            .setLngLat(coords)
            .setHTML(
              `<div style="font-family:system-ui;font-size:12px;line-height:1.4"><strong>${p.name}</strong><br/><span style="color:#6b7280">${typeLabel}</span><br/>${p.address}, ${p.city}</div>`,
            )
            .addTo(map);
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

    if (map.isStyleLoaded()) initAssetLayers();
    else map.on("load", initAssetLayers);

    return () => {
      map.remove();
      mapRef.current = null;
      assetLayersInitRef.current = false;
      initAssetLayersRef.current = null;
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
      drawnCountRef.current = 0;
      appliedCountRef.current = 0;
      await initAssetLayersRef.current?.();
      const pending = instructionsRef.current;
      appliedCountRef.current = pending.length;
      for (const inst of pending) replayInstruction(map, inst, drawnCountRef);
    });
  }, [basemapIdx]);

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
    const fly = () =>
      map.flyTo({
        center: focusTarget.center,
        zoom: focusTarget.zoom,
        essential: true,
      });
    if (map.isStyleLoaded()) fly();
    else map.once("load", fly);
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
