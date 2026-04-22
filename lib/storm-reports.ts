/**
 * Two tornado sighting reports — first and last confirmed positions
 * inside the warning polygon. Connected by a bold red line on the map.
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
    lat: 27.875,
    lon: -82.800,
  },
  {
    id: "rpt-b",
    time: "4:37 PM",
    source: "St. Pete PD",
    label: "Last confirmed sighting",
    location: "4th St N & 54th Ave N, St. Petersburg",
    lat: 27.985,
    lon: -82.690,
  },
];
