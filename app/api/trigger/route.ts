/**
 * POST /api/trigger
 *
 * Simulates an NWS tornado warning over Pinellas County, FL. Returns the
 * warning polygon, map-focus parameters, and a `trigger_directive` that kicks
 * Claude into the tornado playbook with zero user input.
 *
 * This is the anticipatory entry point — the "before you even ask" moment.
 */

import { NextRequest } from "next/server";
import scenarios from "@/data/tornado_scenarios.json";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Scenario {
  id: string;
  name: string;
  warning_type: string;
  nws_event_id: string;
  issued_offset_seconds: number;
  expires_offset_seconds: number;
  focus_center: [number, number];
  focus_zoom: number;
  impacted_cities: string[];
  path_description: string;
  polygon_geojson: { type: "Polygon"; coordinates: number[][][] };
}

export async function POST(req: NextRequest) {
  let body: { scenario_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine; use default
  }

  const scenarioId = body.scenario_id || "tornado_pinellas_replay";
  const scenario = (scenarios.scenarios as unknown as Scenario[]).find(
    (s) => s.id === scenarioId
  );

  if (!scenario) {
    return new Response(
      JSON.stringify({ error: `Unknown scenario: ${scenarioId}` }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const now = new Date();
  const issued = new Date(now.getTime() + scenario.issued_offset_seconds * 1000);
  const expires = new Date(
    now.getTime() + scenario.expires_offset_seconds * 1000
  );

  const polygonJson = JSON.stringify(scenario.polygon_geojson);

  const trigger_directive = [
    `[SYSTEM EVENT]`,
    `The National Weather Service has just issued a ${scenario.warning_type.toUpperCase()} WARNING over central Pinellas County, Florida.`,
    `NWS event ID: ${scenario.nws_event_id}`,
    `Issued:  ${issued.toISOString()}`,
    `Expires: ${expires.toISOString()}`,
    `Path:    ${scenario.path_description}`,
    `Cities in path: ${scenario.impacted_cities.join(", ")}.`,
    ``,
    `Warning polygon (GeoJSON):`,
    polygonJson,
    ``,
    `Run the tornado playbook. Produce the proactive situational briefing NOW, before anyone asks. IMPORTANT: the warning polygon is ALREADY drawn on the map and the impacted tracts will be drawn automatically by the tracts tool — do NOT call draw_on_map at all.`,
    ``,
    `STEP 1 — In parallel, call these three tools with the polygon above:`,
    `  - get_tracts_intersecting_polygon(polygon) → population + SVI ranks + auto-draws the impacted-tract overlay`,
    `  - get_assets_in_polygon(polygon) → NAMED landmarks inside the footprint (schools w/ enrollment, mobile home parks w/ unit counts, hospitals w/ beds, Red Cross sites, fire/police stations)`,
    `  - get_alice_poverty() → Pinellas county-wide ALICE financial hardship context`,
    ``,
    `STEP 2 — Write the briefing. HARD RULES:`,
    `  - ≤100 words total.`,
    `  - Name at least 3 specific landmarks from get_assets_in_polygon: ONE school (name + enrollment), ONE mobile home park (name + unit count — MH residents are ~15× more likely to die in a tornado than site-built residents, so these are high-priority), and ONE hospital OR Red Cross asset.`,
    `  - Use city names ("south St. Petersburg", "Lealman", "central Pinellas Park") — NEVER raw tract GEOIDs in user-facing text.`,
    `  - Include one ALICE line (county % struggling).`,
    `  - End with ONE open question offering a next step (e.g. "Want the nearest Red Cross ERV depots?" / "Pull the full MHP list with unit counts?").`,
    `  - No recommendations about evacuations or shelter openings. Every number must come from your tool calls.`,
  ].join("\n");

  return new Response(
    JSON.stringify({
      success: true,
      scenario_id: scenario.id,
      warning_type: scenario.warning_type,
      nws_event_id: scenario.nws_event_id,
      issued: issued.toISOString(),
      expires: expires.toISOString(),
      polygon: scenario.polygon_geojson,
      focus_center: scenario.focus_center,
      focus_zoom: scenario.focus_zoom,
      trigger_directive,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
