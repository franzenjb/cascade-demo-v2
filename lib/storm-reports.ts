/**
 * Synthetic storm spotter / law enforcement / NWS reports
 * that trace the tornado's path across Pinellas County.
 * Coordinates follow a realistic SW→NE track:
 *   Seminole → Largo → Pinellas Park → Lealman → north St. Pete → I-275 → Tampa Bay
 */

export interface StormReport {
  id: string;
  time: string;
  source: string;
  label: string;
  text: string;
  lat: number;
  lon: number;
}

export const STORM_REPORTS: StormReport[] = [
  {
    id: "rpt-1",
    time: "4:12 PM",
    source: "NWS Tampa Bay",
    label: "Radar rotation",
    text: "TORNADO WARNING for central Pinellas County until 4:47 PM EDT. Radar-indicated rotation near Seminole, moving NE at 35 mph.",
    lat: 27.8397,
    lon: -82.7906,
  },
  {
    id: "rpt-2",
    time: "4:15 PM",
    source: "NWS Tampa Bay",
    label: "Tornado near Seminole",
    text: "Severe thunderstorm producing a TORNADO located near Seminole Blvd and Park Blvd, moving NE at 35 mph. TAKE COVER NOW.",
    lat: 27.8425,
    lon: -82.7731,
  },
  {
    id: "rpt-3",
    time: "4:21 PM",
    source: "Pinellas Sheriff",
    label: "Funnel cloud sighted",
    text: "Report of funnel cloud near the intersection of Ulmerton Rd and Starkey Rd. Deputies responding. Avoid the area.",
    lat: 27.8530,
    lon: -82.7440,
  },
  {
    id: "rpt-4",
    time: "4:24 PM",
    source: "NWS Tampa Bay",
    label: "Tornado confirmed",
    text: "CONFIRMED TORNADO on the ground near Pinellas Park. Debris signature detected on radar. Path toward Gateway area and north St. Petersburg.",
    lat: 27.8612,
    lon: -82.7185,
  },
  {
    id: "rpt-5",
    time: "4:26 PM",
    source: "Pinellas Sheriff",
    label: "Structural damage",
    text: "Multiple 911 calls reporting structural damage near 66th St N and 54th Ave N. Power lines down. First responders en route.",
    lat: 27.8710,
    lon: -82.7050,
  },
  {
    id: "rpt-6",
    time: "4:28 PM",
    source: "PCFD Station 32",
    label: "MHP damage + injuries",
    text: "Engine 32 and Rescue 32 dispatched to mobile home park at 7200 block of 46th Ave N. Reports of roof damage and injuries.",
    lat: 27.8780,
    lon: -82.6920,
  },
  {
    id: "rpt-7",
    time: "4:33 PM",
    source: "NWS Tampa Bay",
    label: "Tornado track NE",
    text: "Tornado continuing NE across Pinellas. Estimated path width 200 yards. Expected to cross I-275 near 38th Ave N by 4:40 PM.",
    lat: 27.8875,
    lon: -82.6740,
  },
  {
    id: "rpt-8",
    time: "4:35 PM",
    source: "Pinellas Sheriff",
    label: "Vehicles overturned",
    text: "Report of overturned vehicles on US-19 near Park Blvd interchange. Northbound lanes blocked. AVOID US-19 from Ulmerton to Gandy.",
    lat: 27.8620,
    lon: -82.7310,
  },
  {
    id: "rpt-9",
    time: "4:37 PM",
    source: "St. Pete PD",
    label: "Debris crossing 4th St",
    text: "Tornado debris observed crossing 4th St N near 46th Ave. All officers directed to take cover. Citizens shelter in place immediately.",
    lat: 27.8950,
    lon: -82.6530,
  },
  {
    id: "rpt-10",
    time: "4:40 PM",
    source: "NWS Tampa Bay",
    label: "Crossing I-275",
    text: "Tornado crossing I-275 corridor. All motorists on I-275, US-19, and Gandy Blvd: EXIT IMMEDIATELY and seek sturdy shelter.",
    lat: 27.9020,
    lon: -82.6350,
  },
];
