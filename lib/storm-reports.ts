/**
 * Eight tornado sighting reports (A-H) along the polygon centerline.
 * SW→NE: Seminole → Largo → Pinellas Park → Lealman → north St. Pete.
 * All coordinates verified inside the warning polygon.
 */

export interface StormReport {
  id: string;
  letter: string;
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
    letter: "A",
    time: "4:15 PM",
    source: "NWS Tampa Bay",
    label: "Radar-indicated rotation",
    location: "Near Seminole Blvd & Park Blvd, Seminole",
    lat: 27.8864,
    lon: -82.8221,
  },
  {
    id: "rpt-b",
    letter: "B",
    time: "4:18 PM",
    source: "Pinellas Sheriff",
    label: "Funnel cloud reported",
    location: "102nd Ave N & Starkey Rd, Seminole/Largo",
    lat: 27.8985,
    lon: -82.7915,
  },
  {
    id: "rpt-c",
    letter: "C",
    time: "4:21 PM",
    source: "NWS Tampa Bay",
    label: "Confirmed tornado on the ground",
    location: "Ulmerton Rd & Belcher Rd, Largo",
    lat: 27.9180,
    lon: -82.7780,
  },
  {
    id: "rpt-d",
    letter: "D",
    time: "4:24 PM",
    source: "PCFD Station 18",
    label: "Structural damage, trees down",
    location: "Bryan Dairy Rd & 66th St N, Pinellas Park",
    lat: 27.9250,
    lon: -82.7400,
  },
  {
    id: "rpt-e",
    letter: "E",
    time: "4:27 PM",
    source: "Pinellas Sheriff",
    label: "Roof damage at mobile home park",
    location: "46th Ave N & US-19, Pinellas Park",
    lat: 27.9410,
    lon: -82.7290,
  },
  {
    id: "rpt-f",
    letter: "F",
    time: "4:30 PM",
    source: "St. Pete PD",
    label: "Debris and power lines down",
    location: "38th Ave N & 49th St, Lealman",
    lat: 27.9530,
    lon: -82.6900,
  },
  {
    id: "rpt-g",
    letter: "G",
    time: "4:33 PM",
    source: "NWS Tampa Bay",
    label: "Tornado crossing I-275",
    location: "I-275 & 38th Ave N, Kenneth City",
    lat: 27.9680,
    lon: -82.6790,
  },
  {
    id: "rpt-h",
    letter: "H",
    time: "4:36 PM",
    source: "St. Pete PD",
    label: "Tornado dissipating over Tampa Bay",
    location: "Gandy Blvd & Tampa Bay, north St. Petersburg",
    lat: 27.9820,
    lon: -82.6520,
  },
];
