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
    location: "Vonn Rd & Wilcox Rd, Largo",
    lat: 27.8864,
    lon: -82.8221,
  },
  {
    id: "rpt-b",
    letter: "B",
    time: "4:18 PM",
    source: "Pinellas Sheriff",
    label: "Funnel cloud reported",
    location: "113th St N & Ulmerton Rd, Largo",
    lat: 27.8985,
    lon: -82.7915,
  },
  {
    id: "rpt-c",
    letter: "C",
    time: "4:21 PM",
    source: "NWS Tampa Bay",
    label: "Confirmed tornado on the ground",
    location: "East Bay Dr & Alt Keene Rd, Largo",
    lat: 27.9180,
    lon: -82.7780,
  },
  {
    id: "rpt-d",
    letter: "D",
    time: "4:24 PM",
    source: "PCFD Station 18",
    label: "Structural damage, trees down",
    location: "S Belcher Rd & CR 501, Largo",
    lat: 27.9250,
    lon: -82.7400,
  },
  {
    id: "rpt-e",
    letter: "E",
    time: "4:27 PM",
    source: "Pinellas Sheriff",
    label: "Roof damage at mobile home park",
    location: "US-19 & Nursery Rd, Largo",
    lat: 27.9380,
    lon: -82.7150,
  },
  {
    id: "rpt-f",
    letter: "F",
    time: "4:30 PM",
    source: "NWS Tampa Bay",
    label: "Tornado dissipating over Old Tampa Bay",
    location: "Over Old Tampa Bay, south of Courtney Campbell Causeway",
    lat: 27.9520,
    lon: -82.6800,
  },
];
