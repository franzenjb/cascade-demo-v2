"use client";

import { useEffect, useState } from "react";
import { STORM_REPORTS } from "@/lib/storm-reports";

interface CrawlOnly {
  time: string;
  source: string;
  text: string;
}

// Non-geolocated alerts that only appear in the crawl (no map marker)
const EXTRA_CRAWL: CrawlOnly[] = [
  {
    time: "4:18 PM",
    source: "Pinellas County EM",
    text: "All emergency shelters in central Pinellas on STANDBY. Largo Community Center and Pinellas Park Recreation Center designated as primary shelters.",
  },
  {
    time: "4:30 PM",
    source: "Duke Energy",
    text: "Approximately 8,400 customers without power in Pinellas Park and Lealman areas. Crews staging but cannot deploy until warning expires.",
  },
];

// Merge storm reports + extra crawl-only items, sorted by time
const ALL_CRAWL = [
  ...STORM_REPORTS.map((r) => ({ time: r.time, source: r.source, text: r.text })),
  ...EXTRA_CRAWL,
].sort((a, b) => {
  const parse = (t: string) => {
    const [h, rest] = t.split(":");
    const [m, ap] = rest.split(" ");
    let hr = parseInt(h);
    if (ap === "PM" && hr !== 12) hr += 12;
    if (ap === "AM" && hr === 12) hr = 0;
    return hr * 60 + parseInt(m);
  };
  return parse(a.time) - parse(b.time);
});

interface Props {
  active: boolean;
  onReportCount?: (count: number) => void;
}

export default function NewsCrawl({ active, onReportCount }: Props) {
  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    if (!active) return;
    setVisibleCount(3);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (visibleCount >= ALL_CRAWL.length) return;
    const timer = setInterval(() => {
      setVisibleCount((c) => Math.min(c + 1, ALL_CRAWL.length));
    }, 8000);
    return () => clearInterval(timer);
  }, [active, visibleCount]);

  // Notify parent how many storm reports (with coords) are now visible
  useEffect(() => {
    if (!active || !onReportCount) return;
    // Count how many of the visible crawl items correspond to geolocated reports
    const visibleItems = ALL_CRAWL.slice(0, visibleCount);
    const geoCount = visibleItems.filter((item) =>
      STORM_REPORTS.some((r) => r.time === item.time && r.source === item.source),
    ).length;
    onReportCount(geoCount);
  }, [active, visibleCount, onReportCount]);

  if (!active) return null;

  const items = ALL_CRAWL.slice(0, visibleCount);

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
