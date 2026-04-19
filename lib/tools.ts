/**
 * Tool definitions and executors for Cascade V2.
 *
 * Tools wrap the real-data sources: Supabase (SVI, NRI, ALICE, FEMA),
 * TIGERweb (tract geometry), and the Florida parcel API. All are scoped to
 * Hillsborough County (FIPS 12057) for the first demo.
 */

import type Anthropic from "@anthropic-ai/sdk";
import * as turf from "@turf/turf";
import type { MapInstruction } from "./types";
import { sbSelect } from "./supabase";
import { fetchParcelsInBbox, fetchParcelStats } from "./parcels";
import { fetchTractsForCounty } from "./tigerweb";

const STATE_FIPS = "12"; // Florida
const COUNTY_FIPS_5 = "12057"; // Hillsborough

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_county_overview",
    description:
      "Get a high-level summary of Hillsborough County: total declarations, ALICE poverty rate, average SVI, dominant natural hazards. Use this to open a briefing.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_fema_history",
    description:
      "Return the FEMA disaster declaration history for Hillsborough County: total count, first year, most recent year, hazard breakdown.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "query_svi_for_county",
    description:
      "Fetch census-tract-level CDC SVI (Social Vulnerability Index) records for Hillsborough. Returns aggregate stats plus top-10 most vulnerable tracts by overall percentile rank.",
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
      "Fetch FEMA NRI (National Risk Index) records for Hillsborough tracts. Returns top hazards by expected annual loss and tracts with highest overall risk.",
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
      "Get ALICE (Asset Limited, Income Constrained, Employed) financial-hardship metrics for Hillsborough: median income, % poverty, % ALICE, % struggling.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "query_parcels_in_bbox",
    description:
      "Query Florida parcel records inside a bounding box (Hillsborough only). Returns a GeoJSON FeatureCollection of parcels with valuation and property-type attributes. Use sparingly — large bboxes return thousands of parcels.",
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
      "Get aggregate parcel statistics for Hillsborough: total parcel count, average valuation, breakdown by property type.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_tract_geometry",
    description:
      "Return GeoJSON tract geometries for Hillsborough County from the US Census TIGERweb service. Use when you want to highlight tracts on the map.",
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
    name: "draw_on_map",
    description:
      "Instruct the frontend to render geometry on the map. Use whenever you want the user to see something — a highlighted tract, a buffer zone, a point of interest.",
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
    sbSelect("fl_fema_declarations", { filters: { fips_5: `eq.${COUNTY_FIPS_5}` } }),
    sbSelect("fl_alice", { filters: { fips_5: `eq.${COUNTY_FIPS_5}` } }),
  ]);
  return {
    content: JSON.stringify({
      county: "Hillsborough",
      state: "FL",
      fips: COUNTY_FIPS_5,
      fema_declarations: fema[0] || null,
      alice: alice[0] || null,
    }),
  };
}

async function execFemaHistory(): Promise<ToolExecutionResult> {
  const rows = await sbSelect("fl_fema_declarations", {
    filters: { fips_5: `eq.${COUNTY_FIPS_5}` },
  });
  return { content: JSON.stringify({ county_fips: COUNTY_FIPS_5, records: rows }) };
}

async function execQuerySvi(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const topN = (input.top_n as number) || 10;
  const rows = await sbSelect<Record<string, unknown>>("fl_svi", {
    filters: { stcnty: `eq.${COUNTY_FIPS_5}` },
    order: "rpl_themes.desc.nullslast",
    limit: topN,
  });
  return {
    content: JSON.stringify({
      county_fips: COUNTY_FIPS_5,
      top_tracts: rows,
      note: `Top ${topN} tracts by overall SVI percentile rank (rpl_themes, 0–1, higher = more vulnerable).`,
    }),
  };
}

async function execQueryNri(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const hazard = input.hazard as string | undefined;
  const orderField = hazard ? `${hazard}_risks.desc.nullslast` : "risk_score.desc.nullslast";
  const rows = await sbSelect<Record<string, unknown>>("fl_nri", {
    filters: { stcofips: `eq.${COUNTY_FIPS_5}` },
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
  const rows = await sbSelect("fl_alice", {
    filters: { fips_5: `eq.${COUNTY_FIPS_5}` },
  });
  return { content: JSON.stringify({ county_fips: COUNTY_FIPS_5, alice: rows[0] || null }) };
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
  const features = await fetchTractsForCounty(STATE_FIPS, "057");
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

// Keep turf import used in case future tool handlers need client-side spatial
// ops (buffer, intersect, etc.). This avoids an unused-import lint on build.
void turf;
