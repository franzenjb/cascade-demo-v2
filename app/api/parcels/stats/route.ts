import { NextResponse } from "next/server";

const PARCEL_API =
  process.env.PARCEL_API_URL ||
  "https://florida-parcels-production-fd39.up.railway.app";

export const revalidate = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const xmin = url.searchParams.get("xmin");
  const ymin = url.searchParams.get("ymin");
  const xmax = url.searchParams.get("xmax");
  const ymax = url.searchParams.get("ymax");

  if (!xmin || !ymin || !xmax || !ymax) {
    return NextResponse.json(
      { error: "xmin, ymin, xmax, ymax required" },
      { status: 400 },
    );
  }

  try {
    const upstream = new URL(`${PARCEL_API}/api/stats`);
    upstream.searchParams.set("xmin", xmin);
    upstream.searchParams.set("ymin", ymin);
    upstream.searchParams.set("xmax", xmax);
    upstream.searchParams.set("ymax", ymax);

    const res = await fetch(upstream.toString(), { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `parcel stats ${res.status}`, detail: text.slice(0, 200) },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
