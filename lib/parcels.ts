/**
 * Florida parcel API client.
 *
 * Points at Dragon's Railway-hosted florida-parcels microservice. Reused from
 * ops.jbf.com. Supports bbox queries and per-county stats. For V2 the demo is
 * scoped to Hillsborough County (FIPS 12057).
 */

const PARCEL_API =
  process.env.PARCEL_API_URL ||
  "https://florida-parcels-production-fd39.up.railway.app";

export interface ParcelBbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface ParcelFilters {
  property_type?: "all" | "residential" | "commercial";
  value_min?: number;
  value_max?: number;
  limit?: number;
}

export async function fetchParcelsInBbox(
  bbox: ParcelBbox,
  filters: ParcelFilters = {}
) {
  const url = new URL(`${PARCEL_API}/api/parcels`);
  url.searchParams.set(
    "bbox",
    [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat].join(",")
  );
  if (filters.property_type && filters.property_type !== "all") {
    url.searchParams.set("property_type", filters.property_type);
  }
  if (filters.value_min !== undefined)
    url.searchParams.set("value_min", String(filters.value_min));
  if (filters.value_max !== undefined)
    url.searchParams.set("value_max", String(filters.value_max));
  if (filters.limit) url.searchParams.set("limit", String(filters.limit));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Parcel API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function fetchParcelStats(countyFips: string) {
  const url = new URL(`${PARCEL_API}/api/stats`);
  url.searchParams.set("county_fips", countyFips);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Parcel stats ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
