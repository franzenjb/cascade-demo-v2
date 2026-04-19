"use client";

import type { AssetType } from "./MapView";

const STROKE_PROPS = {
  fill: "none",
  stroke: "white",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const GLYPH_PATHS: Record<AssetType, string> = {
  red_cross: "M12 5v14M5 12h14",
  hospital: "M8 5v14M16 5v14M8 12h8",
  mobile_home_park:
    "M3 10l9-7 9 7v10a1 1 0 01-1 1h-4v-7h-8v7H4a1 1 0 01-1-1V10z",
  school:
    "M2 10l10-5 10 5-10 5-10-5z M22 10v5 M6 12v5c2 2 4 3 6 3s4-1 6-3v-5",
  fire_station:
    "M12 3c1 3 3 5 4 7 1 1.8 2 3.5 2 5.5A6 6 0 116 15.5c0-1.6.6-2.9 1.4-4 .5.8 1.4 1.3 2.1 1.3-.4-.9-.9-1.9-.9-3 0-2.4 2-5 3.4-6.8z",
  police_station: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

export function AssetIcon({
  type,
  color,
  size = 18,
  title,
}: {
  type: AssetType;
  color: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-label={title ?? type}
      role="img"
    >
      <rect x="0.5" y="0.5" width="23" height="23" rx="5" fill={color} stroke="white" strokeWidth="1" />
      {GLYPH_PATHS[type].split(" M").map((seg, i) => (
        <path key={i} d={i === 0 ? seg : `M${seg}`} {...STROKE_PROPS} />
      ))}
    </svg>
  );
}

export function assetIconSVG(type: AssetType, color: string, size = 48): string {
  const paths = GLYPH_PATHS[type]
    .split(" M")
    .map((seg, i) => `<path d="${i === 0 ? seg : "M" + seg}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><rect x="0.5" y="0.5" width="23" height="23" rx="5" fill="${color}" stroke="white" stroke-width="1"/><g fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}
