/**
 * US Census TIGERweb client — fetches tract geometries for a county.
 *
 * Public ArcGIS REST API; no auth or key required. We call it server-side
 * from /api routes so the browser doesn't see CORS issues.
 */

const TIGER_BASE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query";

export interface TractFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: { GEOID: string; NAME: string; STATE: string; COUNTY: string };
}

export async function fetchTractsForCounty(
  stateFips: string,
  countyFips: string
): Promise<TractFeature[]> {
  const url = new URL(TIGER_BASE);
  url.searchParams.set("where", `STATE='${stateFips}' AND COUNTY='${countyFips}'`);
  url.searchParams.set("outFields", "GEOID,NAME,STATE,COUNTY");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("f", "geojson");
  url.searchParams.set("outSR", "4326");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`TIGERweb ${res.status}: ${await res.text()}`);
  }
  const fc = (await res.json()) as { features?: TractFeature[] };
  return fc.features || [];
}
