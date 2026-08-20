/**
 * GTS — geofence mathematics for attendance.
 *
 * Pure functions, no browser and no server dependencies, so the SAME code
 * runs in both places. That symmetry is the point: the browser uses it to
 * show the employee how far away they are, and the server uses it to
 * decide whether the check-in is accepted. The server's answer is the
 * only one that counts — a coordinate pair arriving from a client is a
 * claim, not a fact.
 */

import { COUNTRY_CENTRE, GOVERNORATES } from './egypt';

/** Mean Earth radius in metres (WGS-84 authalic). */
const EARTH_RADIUS_M = 6_371_008.8;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Geofence extends Coordinates {
  /** Accepted radius in metres. */
  radius: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in metres between two points (Haversine).
 *
 * Accurate to well under a metre at the scale of a site geofence, which
 * is far inside the error of consumer GPS itself.
 */
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ============================================================
   VERDICT
   ============================================================ */

export type GeofenceVerdict =
  | 'INSIDE'
  | 'APPROACHING'
  | 'OUTSIDE'
  | 'IMPLAUSIBLE_ACCURACY'
  | 'OUT_OF_COUNTRY';

export interface GeofenceResult {
  verdict: GeofenceVerdict;
  distance: number;
  /** How far past the fence the employee is; 0 when inside. */
  overshoot: number;
  accepted: boolean;
}

/**
 * A fix reported with worse accuracy than this cannot distinguish inside
 * from outside on a typical site fence, so it is refused rather than
 * guessed at. Urban Cairo GPS is routinely 10–30 m; 200 m means the fix
 * came from cell-tower triangulation or a VPN-influenced IP lookup.
 */
export const MAX_ACCURACY_M = 200;

/** Approaching band — used only to soften the UI as someone nears the
 *  site. It never widens the fence; `accepted` stays false. */
export const APPROACHING_BAND_M = 150;

/**
 * Evaluate a position against a site fence.
 *
 * `accuracy` is the browser's own reported uncertainty in metres
 * (`GeolocationCoordinates.accuracy`). Passing it is what lets the server
 * reject a fix too coarse to mean anything.
 */
export function evaluate(
  fence: Geofence,
  position: Coordinates,
  accuracy?: number,
): GeofenceResult {
  const distance = Math.round(distanceMetres(fence, position));
  const overshoot = Math.max(0, distance - fence.radius);

  const base = { distance, overshoot };

  if (!withinEgypt(position)) {
    return { ...base, verdict: 'OUT_OF_COUNTRY', accepted: false };
  }
  if (accuracy !== undefined && accuracy > MAX_ACCURACY_M) {
    return { ...base, verdict: 'IMPLAUSIBLE_ACCURACY', accepted: false };
  }
  if (distance <= fence.radius) {
    return { ...base, verdict: 'INSIDE', accepted: true };
  }
  if (overshoot <= APPROACHING_BAND_M) {
    return { ...base, verdict: 'APPROACHING', accepted: false };
  }
  return { ...base, verdict: 'OUTSIDE', accepted: false };
}

/**
 * Egypt's bounding box, generously drawn.
 *
 * A cheap sanity check that catches the common failure honestly: a
 * desktop browser falling back to an IP-derived location in another
 * country, or swapped lat/lng. It is a filter, not a security control —
 * a determined spoof passes it, which is why the check-in record also
 * stores the raw coordinates for audit.
 */
export const EGYPT_BOUNDS = {
  north: 31.92,
  south: 21.98,
  west: 24.68,
  east: 36.9,
} as const;

export function withinEgypt(p: Coordinates): boolean {
  return (
    p.lat >= EGYPT_BOUNDS.south &&
    p.lat <= EGYPT_BOUNDS.north &&
    p.lng >= EGYPT_BOUNDS.west &&
    p.lng <= EGYPT_BOUNDS.east
  );
}

/* ============================================================
   SITE DEFAULTS
   ============================================================ */

/**
 * Default fence radius in metres, by site type.
 *
 * A New Cairo logistics yard and a downtown office suite need very
 * different tolerances: too tight and honest staff are locked out by GPS
 * drift between buildings, too loose and the fence stops meaning anything.
 */
export const DEFAULT_RADIUS = {
  office: 100,
  warehouse: 200,
  site: 300,
  yard: 400,
} as const;

export type SiteType = keyof typeof DEFAULT_RADIUS;

/* ============================================================
   MAPS
   ============================================================ */

/**
 * A Google Maps link that opens turn-by-turn navigation to the site.
 *
 * Coordinates come from the project record, which the administrator
 * controls — the employee never types a destination, so they cannot
 * navigate themselves to the wrong place and check in there.
 */
export function navigationUrl(fence: Coordinates, label?: string): string {
  const destination = `${fence.lat},${fence.lng}`;
  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'driving',
  });
  if (label) params.set('destination_place_id', '');
  return `https://www.google.com/maps/dir/?${params}`;
}

/** A plain pin, for viewing rather than navigating to the site. */
export function mapUrl(point: Coordinates, zoom = 17): string {
  return `https://www.google.com/maps/@${point.lat},${point.lng},${zoom}z`;
}

/** Where to centre a new project's map before anything has been pinned:
 *  the governorate capital if one is chosen, else the country centroid. */
export function defaultCentre(governorateCode?: number) {
  const gov = governorateCode
    ? GOVERNORATES.find((g) => g.code === governorateCode)
    : undefined;
  return gov
    ? { lat: gov.lat, lng: gov.lng, zoom: 11 }
    : COUNTRY_CENTRE;
}
