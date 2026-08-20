import { describe, it, expect } from 'vitest';
import {
  distanceMetres,
  evaluate,
  withinEgypt,
  navigationUrl,
  MAX_ACCURACY_M,
  DEFAULT_RADIUS,
} from '@/lib/geofence';

/**
 * The geofence engine.
 *
 * This is the code that decides whether an employee is paid for a day, so
 * it is tested as arithmetic rather than through the interface. The same
 * function runs on the server, where the decision is actually made.
 */

/* The Sixth of October depot. */
const SITE = { lat: 29.9668, lng: 30.9364, radius: DEFAULT_RADIUS.warehouse };

describe('distance', () => {
  it('a point against itself is zero', () => {
    expect(distanceMetres(SITE, SITE)).toBe(0);
  });

  it('matches a known Egyptian intercity distance', () => {
    // Cairo (Tahrir) to Alexandria (Raml) — roughly 180 km great-circle.
    const cairo = { lat: 30.0444, lng: 31.2357 };
    const alexandria = { lat: 31.2001, lng: 29.9187 };
    const km = distanceMetres(cairo, alexandria) / 1000;
    expect(km).toBeGreaterThan(175);
    expect(km).toBeLessThan(185);
  });

  it('is symmetric', () => {
    const a = { lat: 30.0444, lng: 31.2357 };
    const b = { lat: 29.9668, lng: 30.9364 };
    expect(distanceMetres(a, b)).toBeCloseTo(distanceMetres(b, a), 6);
  });

  it('resolves metre-scale differences', () => {
    // ~0.0001° of latitude is about 11 m.
    const near = { lat: SITE.lat + 0.0001, lng: SITE.lng };
    const d = distanceMetres(SITE, near);
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(13);
  });
});

describe('verdicts', () => {
  it('accepts a fix inside the fence', () => {
    const r = evaluate(SITE, { lat: 29.9669, lng: 30.9366 });
    expect(r.verdict).toBe('INSIDE');
    expect(r.accepted).toBe(true);
    expect(r.overshoot).toBe(0);
  });

  it('rejects a fix in another city', () => {
    const r = evaluate(SITE, { lat: 30.0444, lng: 31.2357 });
    expect(r.verdict).toBe('OUTSIDE');
    expect(r.accepted).toBe(false);
    expect(r.distance).toBeGreaterThan(25_000);
  });

  it('approaching is still a refusal', () => {
    // Just beyond the fence but inside the soft band.
    const r = evaluate(SITE, { lat: 29.9689, lng: 30.9364 });
    expect(r.verdict).toBe('APPROACHING');
    // The band softens the UI; it must never widen the fence.
    expect(r.accepted).toBe(false);
  });

  it('the boundary itself is inside', () => {
    const r = evaluate({ ...SITE, radius: 100 }, { lat: SITE.lat, lng: SITE.lng });
    expect(r.accepted).toBe(true);
  });

  it('refuses a fix too coarse to mean anything', () => {
    // Dead centre of the site, but the device admits ±500 m.
    const r = evaluate(SITE, { lat: SITE.lat, lng: SITE.lng }, MAX_ACCURACY_M + 300);
    expect(r.verdict).toBe('IMPLAUSIBLE_ACCURACY');
    expect(r.accepted).toBe(false);
  });

  it('accepts an ordinary urban GPS accuracy', () => {
    const r = evaluate(SITE, { lat: SITE.lat, lng: SITE.lng }, 25);
    expect(r.accepted).toBe(true);
  });

  it('rejects a fix outside Egypt even if the maths would pass', () => {
    // A fence mistakenly configured abroad, with a matching fix.
    const abroad = { lat: 51.5074, lng: -0.1278, radius: 200 };
    const r = evaluate(abroad, { lat: 51.5074, lng: -0.1278 });
    expect(r.verdict).toBe('OUT_OF_COUNTRY');
    expect(r.accepted).toBe(false);
  });

  it('catches swapped latitude and longitude', () => {
    // 30.93, 29.96 is a plausible-looking pair that is not the site.
    const r = evaluate(SITE, { lat: SITE.lng, lng: SITE.lat });
    expect(r.accepted).toBe(false);
  });
});

describe('country bounds', () => {
  it('accepts Egyptian cities', () => {
    expect(withinEgypt({ lat: 30.0444, lng: 31.2357 })).toBe(true); // Cairo
    expect(withinEgypt({ lat: 31.2001, lng: 29.9187 })).toBe(true); // Alexandria
    expect(withinEgypt({ lat: 24.0889, lng: 32.8998 })).toBe(true); // Aswan
  });

  it('rejects neighbouring countries', () => {
    expect(withinEgypt({ lat: 32.8872, lng: 13.1913 })).toBe(false); // Tripoli
    expect(withinEgypt({ lat: 15.5007, lng: 32.5599 })).toBe(false); // Khartoum
    expect(withinEgypt({ lat: 24.7136, lng: 46.6753 })).toBe(false); // Riyadh
  });
});

describe('navigation', () => {
  it('builds a Google Maps route to the saved coordinates', () => {
    const url = navigationUrl(SITE);
    expect(url).toContain('google.com/maps/dir');
    expect(url).toContain('29.9668');
    expect(url).toContain('30.9364');
    expect(url).toContain('travelmode=driving');
  });
});
