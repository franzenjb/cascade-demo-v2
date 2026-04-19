import { NextResponse } from "next/server";
import * as turf from "@turf/turf";
import { fetchTractsForCounty } from "@/lib/tigerweb";
import { sbSelect } from "@/lib/supabase";
import { nearestPlace } from "@/lib/pinellas-places";

const STATE_FIPS = "12";
const COUNTY_FIPS_3 = "103";
const COUNTY_FIPS_5 = "12103";

export const revalidate = 3600;

type NriRow = {
  tractfips?: string;
  risk_score?: number | null;
  hrcn_risks?: number | null;
  cfld_risks?: number | null;
  ifld_risks?: number | null;
  trnd_risks?: number | null;
  wfir_risks?: number | null;
  hwav_risks?: number | null;
};

type SviRow = {
  fips?: string;
  e_totpop?: number | null;
  rpl_themes?: number | null;
  rpl_theme1?: number | null;
  rpl_theme2?: number | null;
  rpl_theme3?: number | null;
  rpl_theme4?: number | null;
};

export async function GET() {
  try {
    const [tracts, sviRows, nriRows] = await Promise.all([
      fetchTractsForCounty(STATE_FIPS, COUNTY_FIPS_3),
      sbSelect<SviRow>("svi", {
        filters: { fips: `like.${COUNTY_FIPS_5}*` },
        select:
          "fips,e_totpop,rpl_themes,rpl_theme1,rpl_theme2,rpl_theme3,rpl_theme4",
        limit: 500,
      }),
      sbSelect<NriRow>("nri", {
        filters: { tractfips: `like.${COUNTY_FIPS_5}*` },
        select:
          "tractfips,risk_score,hrcn_risks,cfld_risks,ifld_risks,trnd_risks,wfir_risks,hwav_risks",
        limit: 500,
      }),
    ]);

    const sviByGeoid = new Map<string, SviRow>(
      sviRows.map((r) => [(r.fips as string) || "", r]),
    );
    const nriByGeoid = new Map<string, NriRow>(
      nriRows.map((r) => [(r.tractfips as string) || "", r]),
    );

    const features = tracts.map((t) => {
      const geoid = t.properties.GEOID;
      const svi = sviByGeoid.get(geoid);
      const nri = nriByGeoid.get(geoid);

      let centroid: [number, number] = [0, 0];
      try {
        const c = turf.centroid(t as GeoJSON.Feature<GeoJSON.Polygon>);
        centroid = c.geometry.coordinates as [number, number];
      } catch {
        // leave as [0,0]
      }
      const place = centroid[0] !== 0 ? nearestPlace(centroid[1], centroid[0]) : "";
      const shortName = (t.properties.NAME || "").replace(/^Census Tract\s+/i, "");

      const svi_pct =
        svi?.rpl_themes != null && svi.rpl_themes >= 0 ? svi.rpl_themes : null;
      const nri_score =
        nri?.risk_score != null ? Number(nri.risk_score) : null;
      const combined_pct =
        svi_pct != null && nri_score != null
          ? Math.round((svi_pct * 100 + nri_score) / 2)
          : svi_pct != null
          ? Math.round(svi_pct * 100)
          : nri_score != null
          ? Math.round(nri_score)
          : null;

      return {
        type: "Feature" as const,
        geometry: t.geometry,
        properties: {
          geoid,
          name: shortName || t.properties.NAME,
          place,
          label: place ? `${place} — Tract ${shortName}` : `Tract ${shortName}`,
          centroid_lng: centroid[0],
          centroid_lat: centroid[1],
          pop: svi?.e_totpop != null ? Number(svi.e_totpop) : null,
          svi_pct,
          svi_theme1: svi?.rpl_theme1 != null ? Number(svi.rpl_theme1) : null,
          svi_theme2: svi?.rpl_theme2 != null ? Number(svi.rpl_theme2) : null,
          svi_theme3: svi?.rpl_theme3 != null ? Number(svi.rpl_theme3) : null,
          svi_theme4: svi?.rpl_theme4 != null ? Number(svi.rpl_theme4) : null,
          nri_score,
          nri_hrcn: nri?.hrcn_risks ?? null,
          nri_cfld: nri?.cfld_risks ?? null,
          nri_ifld: nri?.ifld_risks ?? null,
          nri_trnd: nri?.trnd_risks ?? null,
          nri_wfir: nri?.wfir_risks ?? null,
          nri_hwav: nri?.hwav_risks ?? null,
          combined_pct,
        },
      };
    });

    const collection = {
      type: "FeatureCollection" as const,
      features,
      meta: {
        county_fips: COUNTY_FIPS_5,
        tract_count: features.length,
        svi_rows: sviRows.length,
        nri_rows: nriRows.length,
      },
    };

    return NextResponse.json(collection, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
