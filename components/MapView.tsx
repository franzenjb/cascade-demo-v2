"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import type { MapInstruction } from "@/lib/types";

const POSITRON_STYLE = "https://tiles.openfreemap.org/styles/positron";

interface Props {
  center: [number, number];
  zoom: number;
  instructions: MapInstruction[];
}

export default function MapView({ center, zoom, instructions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const drawnCountRef = useRef(0);

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
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      for (const inst of instructions) {
        if (inst.action === "clear") {
          const toRemove: string[] = [];
          map.getStyle().layers?.forEach((l) => {
            if (l.id.startsWith("cascade-draw-")) toRemove.push(l.id);
          });
          toRemove.forEach((id) => {
            if (map.getLayer(id)) map.removeLayer(id);
            if (map.getSource(id)) map.removeSource(id);
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
