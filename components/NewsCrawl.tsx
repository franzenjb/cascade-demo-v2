"use client";

interface Props {
  active: boolean;
  countdown: string | null;
}

export default function NewsCrawl({ active, countdown }: Props) {
  if (!active) return null;

  return (
    <div className="crawl-bar bg-red-700 text-white overflow-hidden whitespace-nowrap relative h-8 flex items-center">
      <div className="flex-shrink-0 bg-amber-500 text-black font-headline font-bold text-xs uppercase tracking-wider px-3 h-full flex items-center z-10">
        <span className="w-2 h-2 bg-red-700 rounded-full animate-pulse mr-2" />
        TORNADO WARNING
        {countdown && (
          <span className="ml-2 font-data tabular-nums">{countdown}</span>
        )}
      </div>
      <div className="crawl-track flex items-center gap-16 animate-crawl pl-8">
        {[0, 1].map((dup) => (
          <span key={dup} className="inline-flex items-center gap-2 flex-shrink-0">
            <span className="font-data font-bold text-[12px]">
              NWS TAMPA BAY —
            </span>
            <span className="font-data text-[12px]">
              The National Weather Service has issued a TORNADO WARNING for central Pinellas County.
              A severe thunderstorm capable of producing a tornado was located near Seminole, moving NE at 35 mph.
              Path tracks NE across the peninsula from Seminole through Largo, Pinellas Park, and into north St. Petersburg,
              exiting into Tampa Bay near Gandy Boulevard.
              TAKE COVER NOW — move to an interior room on the lowest floor of a sturdy building.
            </span>
            <span className="text-amber-400 mx-6 font-bold">{"///"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
