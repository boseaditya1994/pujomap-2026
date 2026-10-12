export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. This is a straight line, not a travel distance. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function withDistance<T extends LatLng>(items: T[], from: LatLng): (T & { distanceM: number })[] {
  return items
    .map((item) => ({ ...item, distanceM: haversineMeters(from, item) }))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function formatDistance(meters: number, locale: string): string {
  const nf = new Intl.NumberFormat(locale === "bn" ? "bn-IN" : "en-IN", { maximumFractionDigits: 1 });
  return meters < 1000 ? `${nf.format(Math.round(meters / 10) * 10)} m` : `${nf.format(meters / 1000)} km`;
}

export type Bounds = { south: number; north: number; west: number; east: number };

export function boundsOf(points: LatLng[]): Bounds | null {
  if (points.length === 0) return null;
  let south = Infinity,
    north = -Infinity,
    west = Infinity,
    east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return { south, north, west, east };
}

export function isValidLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== "object") return false;
  const { lat, lng } = v as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
