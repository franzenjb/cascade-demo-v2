"use client";

import { useEffect, useState } from "react";

interface CrawlItem {
  time: string;
  source: string;
  text: string;
}

const NWS_ALERTS: CrawlItem[] = [
  {
    time: "4:12 PM",
    source: "NWS Tampa Bay",
    text: "TORNADO WARNING for central Pinellas County until 4:47 PM EDT. Radar-indicated rotation near Seminole, moving NE at 35 mph.",
  },
  {
    time: "4:15 PM",
    source: "NWS Tampa Bay",
    text: "Severe thunderstorm producing a TORNADO located near Seminole Blvd and Park Blvd, moving NE at 35 mph. TAKE COVER NOW.",
  },
  {
    time: "4:18 PM",
    source: "Pinellas County EM",
    text: "All emergency shelters in central Pinellas on STANDBY. Largo Community Center and Pinellas Park Recreation Center designated as primary shelters.",
  },
  {
    time: "4:21 PM",
    source: "Pinellas Sheriff",
    text: "Report of funnel cloud near the intersection of Ulmerton Rd and Starkey Rd. Deputies responding. Avoid the area.",
  },
  {
    time: "4:24 PM",
    source: "NWS Tampa Bay",
    text: "CONFIRMED TORNADO on the ground near Pinellas Park. Debris signature detected on radar. Path toward Gateway area and north St. Petersburg.",
  },
  {
    time: "4:26 PM",
    source: "Pinellas Sheriff",
    text: "Multiple 911 calls reporting structural damage near 66th St N and 54th Ave N. Power lines down. First responders en route.",
  },
  {
    time: "4:28 PM",
    source: "PCFD Station 32",
    text: "Engine 32 and Rescue 32 dispatched to mobile home park at 7200 block of 46th Ave N. Reports of roof damage and injuries.",
  },
  {
    time: "4:30 PM",
    source: "Duke Energy",
    text: "Approximately 8,400 customers without power in Pinellas Park and Lealman areas. Crews staging but cannot deploy until warning expires.",
  },
  {
    time: "4:33 PM",
    source: "NWS Tampa Bay",
    text: "Tornado continuing NE across Pinellas. Estimated path width 200 yards. Expected to cross I-275 near 38th Ave N by 4:40 PM.",
  },
  {
    time: "4:35 PM",
    source: "Pinellas Sheriff",
    text: "Report of overturned vehicles on US-19 near Park Blvd interchange. Northbound lanes blocked. AVOID US-19 from Ulmerton to Gandy.",
  },
  {
    time: "4:37 PM",
    source: "St. Pete PD",
    text: "Tornado debris observed crossing 4th St N near 46th Ave. All officers directed to take cover. Citizens shelter in place immediately.",
  },
  {
    time: "4:40 PM",
    source: "NWS Tampa Bay",
    text: "Tornado crossing I-275 corridor. All motorists on I-275, US-19, and Gandy Blvd: EXIT IMMEDIATELY and seek sturdy shelter.",
  },
];

interface Props {
  active: boolean;
}

export default function NewsCrawl({ active }: Props) {
  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    if (!active) return;
    if (visibleCount >= NWS_ALERTS.length) return;
    const timer = setInterval(() => {
      setVisibleCount((c) => Math.min(c + 1, NWS_ALERTS.length));
    }, 8000);
    return () => clearInterval(timer);
  }, [active, visibleCount]);

  if (!active) return null;

  const items = NWS_ALERTS.slice(0, visibleCount);

  return (
    <div className="crawl-bar bg-amber-500 text-black overflow-hidden whitespace-nowrap relative h-7 flex items-center">
      <div className="flex-shrink-0 bg-red-700 text-white font-headline font-bold text-xs uppercase tracking-wider px-3 h-full flex items-center z-10">
        LIVE ALERTS
      </div>
      <div className="crawl-track flex items-center gap-12 animate-crawl pl-8">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 flex-shrink-0">
            <span className="font-data font-bold text-[11px] text-red-900">
              {item.time}
            </span>
            <span className="font-data font-bold text-[11px] uppercase">
              [{item.source}]
            </span>
            <span className="font-data text-[11px]">
              {item.text}
            </span>
            <span className="text-red-800 mx-4">{"///"}</span>
          </span>
        ))}
        {/* Duplicate for seamless loop */}
        {items.map((item, i) => (
          <span key={`dup-${i}`} className="inline-flex items-center gap-2 flex-shrink-0">
            <span className="font-data font-bold text-[11px] text-red-900">
              {item.time}
            </span>
            <span className="font-data font-bold text-[11px] uppercase">
              [{item.source}]
            </span>
            <span className="font-data text-[11px]">
              {item.text}
            </span>
            <span className="text-red-800 mx-4">{"///"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
