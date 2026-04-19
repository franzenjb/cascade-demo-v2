export interface PlaceCentroid {
  name: string;
  lat: number;
  lon: number;
}

export const PINELLAS_PLACES: PlaceCentroid[] = [
  { name: "St. Petersburg", lat: 27.7676, lon: -82.6403 },
  { name: "Clearwater", lat: 27.9659, lon: -82.8001 },
  { name: "Largo", lat: 27.9095, lon: -82.7873 },
  { name: "Pinellas Park", lat: 27.8428, lon: -82.6995 },
  { name: "Dunedin", lat: 28.0199, lon: -82.7723 },
  { name: "Tarpon Springs", lat: 28.1461, lon: -82.7565 },
  { name: "Palm Harbor", lat: 28.0780, lon: -82.7637 },
  { name: "East Lake", lat: 28.1060, lon: -82.7100 },
  { name: "Oldsmar", lat: 28.0328, lon: -82.6651 },
  { name: "Safety Harbor", lat: 27.9905, lon: -82.6934 },
  { name: "Seminole", lat: 27.8394, lon: -82.7900 },
  { name: "Lealman", lat: 27.8206, lon: -82.6934 },
  { name: "Kenneth City", lat: 27.8144, lon: -82.7276 },
  { name: "Gulfport", lat: 27.7486, lon: -82.7029 },
  { name: "South Pasadena", lat: 27.7536, lon: -82.7412 },
  { name: "St. Pete Beach", lat: 27.7266, lon: -82.7457 },
  { name: "Treasure Island", lat: 27.7711, lon: -82.7690 },
  { name: "Madeira Beach", lat: 27.7972, lon: -82.7965 },
  { name: "Redington Beach", lat: 27.8148, lon: -82.8124 },
  { name: "Indian Rocks Beach", lat: 27.8786, lon: -82.8493 },
  { name: "Belleair", lat: 27.9339, lon: -82.8079 },
  { name: "Belleair Beach", lat: 27.9145, lon: -82.8462 },
  { name: "Tierra Verde", lat: 27.6872, lon: -82.7265 },
];

export function nearestPlace(lat: number, lon: number): string {
  let best = PINELLAS_PLACES[0];
  let bestD = Infinity;
  for (const p of PINELLAS_PLACES) {
    const dLat = p.lat - lat;
    const dLon = (p.lon - lon) * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.name;
}
