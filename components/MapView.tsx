"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import type { MapInstruction } from "@/lib/types";
import assetsJson from "@/data/pinellas_assets.json";

const POSITRON_STYLE = "https://tiles.openfreemap.org/styles/positron";

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: POSITRON_STYLE,
      center,
      zoom,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    const initAssetLayers = () => {
      if (assetLayersInitRef.current) return;
      assetLayersInitRef.current = true;
      for (const { key, color } of ASSET_TYPES) {
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
        if (!map.getLayer(`${sourceId}-circle`)) {
          map.addLayer({
            id: `${sourceId}-circle`,
            type: "circle",
            source: sourceId,
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                3,
                11,
                5,
                14,
                8,
              ],
              "circle-color": color,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.95,
            },
            layout: { visibility: "visible" },
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
              "text-offset": [0, 1.1],
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
        map.on("click", `cascade-asset-${key}-circle`, (e) => {
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
        map.on("mouseenter", `cascade-asset-${key}-circle`, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", `cascade-asset-${key}-circle`, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    };

    if (map.isStyleLoaded()) initAssetLayers();
    else map.on("load", initAssetLayers);

    return () => {
      map.remove();
      mapRef.current = null;
      assetLayersInitRef.current = false;
    };
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !assetVisibility) return;
    const apply = () => {
      for (const { key } of ASSET_TYPES) {
        const vis = assetVisibility[key] ? "visible" : "none";
        if (map.getLayer(`cascade-asset-${key}-circle`)) {
          map.setLayoutProperty(`cascade-asset-${key}-circle`, "visibility", vis);
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
      for (const inst of pending) {
        if (inst.action === "clear") {
          const toRemoveLayers: string[] = [];
          map.getStyle().layers?.forEach((l) => {
            if (l.id.startsWith("cascade-draw-")) toRemoveLayers.push(l.id);
          });
          toRemoveLayers.forEach((id) => {
            if (map.getLayer(id)) map.removeLayer(id);
          });
          const sources = Object.keys((map.getStyle().sources || {})).filter((s) =>
            s.startsWith("cascade-draw-"),
          );
          sources.forEach((s) => {
            if (map.getSource(s)) map.removeSource(s);
          });
          drawnCountRef.current = 0;
          continue;
        }

        if (inst.action === "draw" && inst.geometry) {
          const id = `cascade-draw-${drawnCountRef.current++}`;
          const geom = inst.geometry as unknown as GeoJSON.Geometry | GeoJSON.FeatureCollection;
          const data: GeoJSON.FeatureCollection =
            (geom as GeoJSON.FeatureCollection).type === "FeatureCollection"
              ? (geom as GeoJSON.FeatureCollection)
              : {
                  type: "FeatureCollection",
                  features: [{ type: "Feature", geometry: geom as GeoJSON.Geometry, properties: {} }],
                };
          map.addSource(id, { type: "geojson", data });
          const color = inst.style?.color || "#ED1B2E";
          const opacity = inst.style?.opacity ?? 0.35;
          // Polygon fill
          map.addLayer({
            id: `${id}-fill`,
            type: "fill",
            source: id,
            paint: { "fill-color": color, "fill-opacity": opacity },
            filter: ["==", ["geometry-type"], "Polygon"],
          });
          map.addLayer({
            id: `${id}-line`,
            type: "line",
            source: id,
            paint: { "line-color": color, "line-width": 2 },
            filter: ["in", ["geometry-type"], ["literal", ["Polygon", "LineString"]]],
          });
          map.addLayer({
            id: `${id}-point`,
            type: "circle",
            source: id,
            paint: { "circle-color": color, "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
            filter: ["==", ["geometry-type"], "Point"],
          });
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [instructions]);

  return <div ref={containerRef} className="map-container" />;
}
