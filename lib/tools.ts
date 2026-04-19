/**
 * Tool definitions and executors for Cascade V2.
 *
 * Tools wrap the real-data sources: Supabase (SVI, NRI, ALICE, FEMA),
 * TIGERweb (tract geometry), and the Florida parcel API. All are scoped to
 * Pinellas County (FIPS 12103) — the county of the tornado demo scenario.
 */

import type Anthropic from "@anthropic-ai/sdk";
import * as turf from "@turf/turf";
import type { MapInstruction } from "./types";
import { sbSelect } from "./supabase";
import { fetchParcelsInBbox, fetchParcelStats } from "./parcels";
import { fetchTractsForCounty, type TractFeature } from "./tigerweb";
import assetsData from "@/data/pinellas_assets.json";

interface Asset {
  id: string;
  type: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  city: string;
  attrs: Record<string, unknown>;
}

const ASSETS: Asset[] = (assetsData as { assets: Asset[] }).assets;

const STATE_FIPS = "12"; // Florida
const COUNTY_FIPS_3 = "103"; // Pinellas (3-digit, used by TIGERweb)
const COUNTY_FIPS_5 = "12103"; // Pinellas (5-digit, used by SVI/NRI/ALICE/FEMA tables)

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_county_overview",
    description:
      "Get a high-level summary of Pinellas County: total FEMA declarations, ALICE poverty rate, average SVI, dominant natural hazards. Use this to open a briefing.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_fema_history",
    description:
      "Return the FEMA disaster declaration history for Pinellas County: total count, first year, most recent year, hazard breakdown.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "query_svi_for_county",
    description:
      "Fetch census-tract-level CDC SVI (Social Vulnerability Index) records for Pinellas. Returns aggregate stats plus top-N most vulnerable tracts by overall percentile rank.",
    input_schema: {
      type: "object",
      properties: {
        top_n: { type: "number", description: "How many top-ranked tracts to return", default: 10 },
      },
    },
  },
  {
    name: "query_nri_for_county",
    description:
      "Fetch FEMA NRI (National Risk Index) records for Pinellas tracts. Returns top hazards by expected annual loss and tracts with highest overall risk.",
    input_schema: {
      type: "object",
      properties: {
        hazard: {
          type: "string",
          description: "Optional hazard filter: hurricane, tornado, wildfire, flood, heat_wave",
        },
      },
    },
  },
  {
    name: "get_alice_poverty",
    description:
      "Get ALICE (Asset Limited, Income Constrained, Employed) financial-hardship metrics for Pinellas: median income, % poverty, % ALICE, % struggling.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_tracts_intersecting_polygon",
    description:
      "Given a GeoJSON Polygon (e.g. an NWS warning polygon), return the Pinellas census tracts that intersect it. Returns aggregate population inside, tract GEOIDs, top tracts by vulnerability, and a summary of the FeatureCollection. **The intersecting tracts are drawn on the map automatically** (navy overlay, labeled 'Impacted Tracts') — do NOT call draw_on_map for them separately. This is the core anticipatory tool — call it whenever there is an active warning polygon.",
    input_schema: {
      type: "object",
      properties: {
        polygon: {
          type: "object",
          description: "GeoJSON Polygon object: { type: 'Polygon', coordinates: [[[lng, lat], ...]] }",
        },
      },
      required: ["polygon"],
    },
  },
  {
    name: "query_parcels_in_bbox",
    description:
      "Query Florida parcel records inside a bounding box (Pinellas only). Returns a GeoJSON FeatureCollection of parcels with valuation and property-type attributes. Use sparingly — large bboxes return thousands of parcels.",
    input_schema: {
      type: "object",
      properties: {
        bbox: {
          type: "array",
          description: "[minLng, minLat, maxLng, maxLat]",
          items: { type: "number" },
          minItems: 4,
          maxItems: 4,
        },
        property_type: {
          type: "string",
          enum: ["all", "residential", "commercial"],
          default: "all",
        },
        value_min: { type: "number" },
        value_max: { type: "number" },
        limit: { type: "number", default: 500 },
      },
      required: ["bbox"],
    },
  },
  {
    name: "get_parcel_stats",
    description:
      "Get aggregate parcel statistics for Pinellas: total parcel count, average valuation, breakdown by property type.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_tract_geometry",
    description:
      "Return GeoJSON tract geometries for Pinellas County from the US Census TIGERweb service. Use when you want to highlight tracts on the map.",
    input_schema: {
      type: "object",
      properties: {
        tract_geoids: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of 11-digit GEOIDs to filter to. Omit for all county tracts.",
        },
      },
    },
  },
  {
    name: "get_assets_in_polygon",
    description:
      "Given a GeoJSON Polygon (e.g. an NWS warning polygon), return named Pinellas County assets inside it: Red Cross sites, schools, fire stations, police stations, mobile home parks, hospitals. Each asset includes its real name, address, city, and type-specific attributes (enrollment, beds, units, shelter capacity, etc.). USE THIS WHENEVER THERE IS A WARNING POLYGON — briefings MUST cite named landmarks (\"Pinellas Park High School, enrollment 2,118\") not tract GEOIDs.",
    input_schema: {
      type: "object",
      properties: {
        polygon: {
          type: "object",
          description: "GeoJSON Polygon object: { type: 'Polygon', coordinates: [[[lng, lat], ...]] }",
        },
        types: {
          type: "array",
          items: {
            type: "string",
            enum: ["red_cross", "school", "fire_station", "police_station", "mobile_home_park", "hospital"],
          },
          description: "Optional filter to asset types. Omit to return all types.",
        },
      },
      required: ["polygon"],
    },
  },
  {
    name: "get_red_cross_nearest",
    description:
      "Return the nearest Red Cross assets (chapter office, ERV depot, volunteer hub, staging site, DSC, warehouse) to a given lat/lon, with straight-line distance in miles. Use to answer \"what Red Cross resources are closest to the impact area?\"",
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lon: { type: "number" },
        limit: { type: "number", default: 3 },
      },
      required: ["lat", "lon"],
    },
  },
  {
    name: "get_asset_layer",
    description:
      "Return the full Pinellas asset layer of a given type as a GeoJSON FeatureCollection of points, suitable for draw_on_map. Use when the user wants to see all schools, hospitals, MHPs, etc. on the map.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["red_cross", "school", "fire_station", "police_station", "mobile_home_park", "hospital"],
        },
      },
      required: ["type"],
    },
  },
  {
    name: "draw_on_map",
    description:
      "Instruct the frontend to render geometry on the map. Use whenever you want the user to see something — a highlighted tract set, a warning polygon, a point of interest.",
    input_schema: {
      type: "object",
      properties: {
        geometry: { type: "object", description: "GeoJSON geometry or FeatureCollection" },
        style: {
          type: "object",
          properties: {
            color: { type: "string" },
            opacity: { type: "number" },
            label: { type: "string" },
          },
        },
        layer_label: { type: "string" },
      },
      required: ["geometry"],
    },
  },
  {
    name: "generate_briefing_draft",
    description:
      "Produce a one-page leadership briefing in Red Cross format. Use when the user asks for a shareable summary.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        key_stats: { type: "object" },
        recommendations: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["summary", "key_stats"],
    },
  },
];

export interface ToolExecutionResult {
  content: string;
  mapInstruction?: MapInstruction;
}

export async function executeToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (name) {
    case "get_county_overview":
      return execCountyOverview();
    case "get_fema_history":
      return execFemaHistory();
    case "query_svi_for_county":
      return execQuerySvi(input);
    case "query_nri_for_county":
      return execQueryNri(input);
    case "get_alice_poverty":
      return execAlice();
    case "get_tracts_intersecting_polygon":
      return execTractsIntersectingPolygon(input);
    case "get_assets_in_polygon":
      return execAssetsInPolygon(input);
    case "get_red_cross_nearest":
      return execRedCrossNearest(input);
    case "get_asset_layer":
      return execAssetLayer(input);
    case "query_parcels_in_bbox":
      return execParcelsBbox(input);
    case "get_parcel_stats":
      return execParcelStats();
    case "get_tract_geometry":
      return execTractGeometry(input);
    case "draw_on_map":
      return execDrawOnMap(input);
    case "generate_briefing_draft":
      return execBriefing(input);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function execCountyOverview(): Promise<ToolExecutionResult> {
  const [fema, alice] = await Promise.all([
    sbSelect("fema_declarations", { filters: { fips_5: `eq.${COUNTY_FIPS_5}` } }),
    sbSelect("alice", { filters: { fips_5: `eq.${COUNTY_FIPS_5}` } }),
  ]);
  return {
    content: JSON.stringify({
      county: "Pinellas",
      state: "FL",
      fips: COUNTY_FIPS_5,
      fema_declarations: fema[0] || null,
      alice: alice[0] || null,
    }),
  };
}

async function execFemaHistory(): Promise<ToolExecutionResult> {
  const rows = await sbSelect("fema_declarations", {
    filters: { fips_5: `eq.${COUNTY_FIPS_5}` },
  });
  return { content: JSON.stringify({ county_fips: COUNTY_FIPS_5, records: rows }) };
}

async function execQuerySvi(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const topN = (input.top_n as number) || 10;
  const rows = await sbSelect<Record<string, unknown>>("svi", {
    filters: { fips: `like.${COUNTY_FIPS_5}*` },
    order: "rpl_themes.desc.nullslast",
    limit: topN,
  });
  return {
    content: JSON.stringify({
      county_fips: COUNTY_FIPS_5,
      top_tracts: rows,
      note: `Top ${topN} Pinellas tracts by overall SVI percentile rank (rpl_themes, 0–1, higher = more vulnerable).`,
    }),
  };
}

async function execQueryNri(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const hazard = input.hazard as string | undefined;
  const orderField = hazard ? `${hazard}_risks.desc.nullslast` : "risk_score.desc.nullslast";
  const rows = await sbSelect<Record<string, unknown>>("nri", {
    filters: { tractfips: `like.${COUNTY_FIPS_5}*` },
    order: orderField,
    limit: 10,
  });
  return {
    content: JSON.stringify({
      county_fips: COUNTY_FIPS_5,
      hazard: hazard || "overall",
      top_tracts: rows,
    }),
  };
}

async function execAlice(): Promise<ToolExecutionResult> {
  const rows = await sbSelect("alice", {
    filters: { fips_5: `eq.${COUNTY_FIPS_5}` },
  });
  return { content: JSON.stringify({ county_fips: COUNTY_FIPS_5, alice: rows[0] || null }) };
}

async function execTractsIntersectingPolygon(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const poly = input.polygon as GeoJSON.Polygon | undefined;
  if (!poly || poly.type !== "Polygon" || !Array.isArray(poly.coordinates)) {
    throw new Error("polygon must be a GeoJSON Polygon object");
  }

  const [tracts, sviRows] = await Promise.all([
    fetchTractsForCounty(STATE_FIPS, COUNTY_FIPS_3),
    sbSelect<Record<string, unknown>>("svi", {
      filters: { fips: `like.${COUNTY_FIPS_5}*` },
      select: "fips,e_totpop,rpl_themes,rpl_theme1,rpl_theme2,rpl_theme3,rpl_theme4",
      limit: 500,
    }),
  ]);

  const sviByGeoid = new Map<string, Record<string, unknown>>(
    sviRows.map((r) => [r.fips as string, r])
  );

  const warningFeat = turf.feature(poly) as GeoJSON.Feature<GeoJSON.Polygon>;

  interface Hit {
    geoid: string;
    name: string;
    pop: number;
    rpl_themes: number | null;
    rpl_theme1: number | null;
    rpl_theme2: number | null;
    rpl_theme3: number | null;
    rpl_theme4: number | null;
  }

  const hits: Hit[] = [];
  const hitGeoids = new Set<string>();
  let totalPop = 0;

  for (const tract of tracts as TractFeature[]) {
    const tractFeat = turf.feature(tract.geometry) as GeoJSON.Feature<GeoJSON.Polygon>;
    let intersects = false;
    try {
      intersects = turf.booleanIntersects(warningFeat, tractFeat);
    } catch {
      intersects = false;
    }
    if (!intersects) continue;

    const geoid = tract.properties.GEOID;
    const svi = sviByGeoid.get(geoid);
    const pop = svi ? Number(svi.e_totpop) || 0 : 0;
    totalPop += pop;
    hitGeoids.add(geoid);
    hits.push({
      geoid,
      name: tract.properties.NAME,
      pop,
      rpl_themes: svi ? toNum(svi.rpl_themes) : null,
      rpl_theme1: svi ? toNum(svi.rpl_theme1) : null,
      rpl_theme2: svi ? toNum(svi.rpl_theme2) : null,
      rpl_theme3: svi ? toNum(svi.rpl_theme3) : null,
      rpl_theme4: svi ? toNum(svi.rpl_theme4) : null,
    });
  }

  hits.sort((a, b) => (b.rpl_themes ?? 0) - (a.rpl_themes ?? 0));

  const tractFeatures = (tracts as TractFeature[])
    .filter((t) => hitGeoids.has(t.properties.GEOID))
    .map((t) => ({
      type: "Feature" as const,
      geometry: t.geometry,
      properties: { GEOID: t.properties.GEOID, NAME: t.properties.NAME },
    }));

  const tractFeatureCollection: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: tractFeatures,
  };

  const autoDrawInstruction: MapInstruction = {
    action: "draw",
    geometry: tractFeatureCollection as unknown as MapInstruction["geometry"],
    style: { color: "#1E4A6D", opacity: 0.22, label: "Impacted Tracts" },
    layer_label: "Impacted Tracts",
  };

  return {
    content: JSON.stringify({
      county_fips: COUNTY_FIPS_5,
      intersecting_tract_count: hits.length,
      total_population_inside: totalPop,
      all_intersecting_tract_geoids: Array.from(hitGeoids),
      top_tracts_by_vulnerability: hits.slice(0, 10),
      tract_feature_collection_drawn: true,
      note:
        "Population is summed from CDC SVI e_totpop for each intersecting tract. The intersecting tracts have been drawn on the map automatically — do NOT call draw_on_map for them.",
    }),
    mapInstruction: autoDrawInstruction,
  };
}

async function execParcelsBbox(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const [minLng, minLat, maxLng, maxLat] = input.bbox as number[];
  const result = await fetchParcelsInBbox(
    { minLng, minLat, maxLng, maxLat },
    {
      property_type: (input.property_type as "all" | "residential" | "commercial") || "all",
      value_min: input.value_min as number | undefined,
      value_max: input.value_max as number | undefined,
      limit: (input.limit as number) || 500,
    }
  );
  return { content: JSON.stringify(result) };
}

async function execParcelStats(): Promise<ToolExecutionResult> {
  const stats = await fetchParcelStats(COUNTY_FIPS_5);
  return { content: JSON.stringify(stats) };
}

async function execTractGeometry(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const features = await fetchTractsForCounty(STATE_FIPS, COUNTY_FIPS_3);
  const filter = input.tract_geoids as string[] | undefined;
  const filtered = filter
    ? features.filter((f) => filter.includes(f.properties.GEOID))
    : features;
  return {
    content: JSON.stringify({
      type: "FeatureCollection",
      features: filtered,
      count: filtered.length,
    }),
  };
}

async function execDrawOnMap(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const mi: MapInstruction = {
    action: "draw",
    geometry: input.geometry as MapInstruction["geometry"],
    style: (input.style as MapInstruction["style"]) || {},
    layer_label: input.layer_label as string | undefined,
  };
  return {
    content: JSON.stringify({ success: true, instruction: mi }),
    mapInstruction: mi,
  };
}

async function execBriefing(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const summary = input.summary as string;
  const keyStats = input.key_stats as Record<string, unknown>;
  const recs = (input.recommendations as string[]) || [];
  const briefing = `# Leadership Briefing
Generated: ${new Date().toISOString()}

## Summary
${summary}

## Key Statistics
${Object.entries(keyStats).map(([k, v]) => `- **${k.replace(/_/g, " ")}:** ${v}`).join("\n")}

## Recommended Next Steps
${recs.map((r, i) => `${i + 1}. ${r}`).join("\n")}
`;
  return { content: JSON.stringify({ briefing, format: "markdown" }) };
}

async function execAssetsInPolygon(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const poly = input.polygon as GeoJSON.Polygon | undefined;
  if (!poly || poly.type !== "Polygon" || !Array.isArray(poly.coordinates)) {
    throw new Error("polygon must be a GeoJSON Polygon object");
  }
  const typeFilter = (input.types as string[] | undefined) ?? null;
  const polyFeat = turf.feature(poly) as GeoJSON.Feature<GeoJSON.Polygon>;

  const inside: Asset[] = [];
  for (const a of ASSETS) {
    if (typeFilter && !typeFilter.includes(a.type)) continue;
    const pt = turf.point([a.lon, a.lat]);
    if (turf.booleanPointInPolygon(pt, polyFeat)) inside.push(a);
  }

  const byType: Record<string, Asset[]> = {};
  for (const a of inside) {
    (byType[a.type] ||= []).push(a);
  }

  const schools = byType.school || [];
  const mhps = byType.mobile_home_park || [];
  const hospitals = byType.hospital || [];
  const rc = byType.red_cross || [];
  const fire = byType.fire_station || [];
  const police = byType.police_station || [];

  const total_enrollment = schools.reduce(
    (s, a) => s + (Number(a.attrs.enrollment) || 0),
    0
  );
  const total_mhp_units = mhps.reduce(
    (s, a) => s + (Number(a.attrs.units) || 0),
    0
  );
  const total_hospital_beds = hospitals.reduce(
    (s, a) => s + (Number(a.attrs.beds) || 0),
    0
  );

  return {
    content: JSON.stringify({
      total_assets_inside: inside.length,
      counts: {
        red_cross: rc.length,
        schools: schools.length,
        fire_stations: fire.length,
        police_stations: police.length,
        mobile_home_parks: mhps.length,
        hospitals: hospitals.length,
      },
      aggregate: {
        total_school_enrollment: total_enrollment,
        total_mhp_units,
        total_hospital_beds,
      },
      assets: inside.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        address: a.address,
        city: a.city,
        lat: a.lat,
        lon: a.lon,
        attrs: a.attrs,
      })),
      note:
        "Named assets inside the polygon. Use these names in the briefing — e.g. 'Pinellas Park High School (enrollment 2,118)' — never raw tract GEOIDs.",
    }),
  };
}

async function execRedCrossNearest(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const lat = input.lat as number;
  const lon = input.lon as number;
  const limit = (input.limit as number) || 3;
  const origin = turf.point([lon, lat]);

  const rc = ASSETS.filter((a) => a.type === "red_cross").map((a) => ({
    asset: a,
    distance_mi: turf.distance(origin, turf.point([a.lon, a.lat]), {
      units: "miles",
    }),
  }));
  rc.sort((a, b) => a.distance_mi - b.distance_mi);

  return {
    content: JSON.stringify({
      origin: { lat, lon },
      nearest: rc.slice(0, limit).map((r) => ({
        id: r.asset.id,
        name: r.asset.name,
        role: r.asset.attrs.role,
        address: r.asset.address,
        city: r.asset.city,
        lat: r.asset.lat,
        lon: r.asset.lon,
        distance_mi: Math.round(r.distance_mi * 10) / 10,
        has_erv: r.asset.attrs.has_erv,
        erv_count: r.asset.attrs.erv_count,
        shelter_capacity: r.asset.attrs.shelter_capacity,
      })),
    }),
  };
}

async function execAssetLayer(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const type = input.type as string;
  const subset = ASSETS.filter((a) => a.type === type);
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: subset.map((a) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [a.lon, a.lat] },
      properties: {
        id: a.id,
        type: a.type,
        name: a.name,
        address: a.address,
        city: a.city,
        ...a.attrs,
      },
    })),
  };
  return {
    content: JSON.stringify({
      type,
      count: subset.length,
      feature_collection: fc,
    }),
  };
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
