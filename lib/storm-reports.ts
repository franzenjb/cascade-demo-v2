/**
 * Two tornado sighting reports — Point A (first sighting) and Point B
 * (second sighting ~10% further along the path). Both inside the
 * warning polygon, close together.
 *
 * Polygon corners for reference:
 *   SW: (-82.825, 27.841)  SE: (-82.597, 27.948)
 *   NW: (-82.863, 27.907)  NE: (-82.654, 28.047)
 */

export interface StormReport {
  id: string;
  time: string;
  source: string;
  label: string;
  location: string;
  lat: number;
  lon: number;
}

export const STORM_REPORTS: StormReport[] = [
  {
    id: "rpt-a",
    time: "4:15 PM",
    source: "NWS Tampa Bay",
    label: "First confirmed tornado",
    location: "Seminole Blvd & Park Blvd, Seminole",
    lat: 27.870,
    lon: -82.790,
  },
  {
    id: "rpt-b",
    time: "4:22 PM",
    source: "Pinellas Sheriff",
    label: "Confirmed on the ground",
    location: "Ulmerton Rd & Starkey Rd, Largo",
    lat: 27.893,
    lon: -82.770,
  },
];
