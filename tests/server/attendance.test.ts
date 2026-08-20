import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

import { db } from '@/lib/db';
import {
  checkIn,
  checkOut,
  assignedSites,
  siteRoster,
  cairoWorkDate,
  cairoMinutes,
  isCairoWeekend,
  AttendanceError,
} from '@/lib/services/attendance';
import { distanceMetres } from '@/lib/geofence';

/**
 * Attendance, against the real database.
 *
 * The premise under test is that the SERVER decides. Every case here
 * posts coordinates the way a browser would — including coordinates a
 * dishonest browser would post — and asserts on what the server wrote,
 * not on what the caller claimed.
 */

let actor: { id: string; email: string };
let employeeId: string;
let unassignedEmployeeId: string;
let projectId: string;
let projectCode: string;
let site: { lat: number; lng: number; radius: number };

beforeAll(async () => {
  actor = await db.user.findFirstOrThrow({
    where: { email: 'admin@gts.example' },
    select: { id: true, email: true },
  });

  // PRJ-0142 (Palm Hills New Cairo) has EMP-005 assigned and a 300m fence.
  const project = await db.project.findFirstOrThrow({
    where: { code: 'PRJ-0142' },
    select: { id: true, code: true, location: true },
  });
  projectId = project.id;
  projectCode = project.code;
  site = {
    lat: Number(project.location!.latitude),
    lng: Number(project.location!.longitude),
    radius: project.location!.radiusMetres,
  };

  employeeId = (await db.employee.findFirstOrThrow({ where: { code: 'EMP-005' }, select: { id: true } })).id;
  // EMP-002 (the financial controller) is assigned to no site.
  unassignedEmployeeId = (await db.employee.findFirstOrThrow({ where: { code: 'EMP-002' }, select: { id: true } })).id;
});

async function clearAttendance() {
  await db.attendance.deleteMany({ where: { projectId } });
}

beforeEach(clearAttendance);
afterAll(async () => {
  await clearAttendance();
  await db.$disconnect();
});

/** Downtown Cairo — ~25km from the New Cairo site. */
const downtownCairo = { latitude: 30.0444, longitude: 31.2357 };

describe('the server decides, not the browser', () => {
  it('accepts a check-in inside the fence and stores its OWN distance', async () => {
    const result = await checkIn({
      actor, employeeId, projectId,
      latitude: site.lat, longitude: site.lng,
      accuracy: 12,
    });

    expect(result.geofence.accepted).toBe(true);
    expect(result.attendance.distanceMetres).toBeLessThanOrEqual(site.radius);

    const stored = await db.attendance.findUniqueOrThrow({ where: { id: result.attendance.id } });
    // The persisted distance is the server's Haversine result, and the
    // radius recorded is the one in force at this moment.
    expect(stored.distanceMetres).toBe(result.attendance.distanceMetres);
    expect(stored.radiusAtCheckIn).toBe(site.radius);
  });

  it('refuses a check-in outside the fence and says how far away', async () => {
    await expect(
      checkIn({ actor, employeeId, projectId, ...downtownCairo, accuracy: 10 }),
    ).rejects.toMatchObject({
      code: 'OUTSIDE_GEOFENCE',
      detail: expect.objectContaining({ radius: site.radius }),
    });

    // And nothing was written.
    expect(await db.attendance.count({ where: { projectId } })).toBe(0);
  });

  it('gives the refusal a real distance, so the screen can offer navigation', async () => {
    const expected = Math.round(
      distanceMetres({ lat: site.lat, lng: site.lng }, { lat: downtownCairo.latitude, lng: downtownCairo.longitude }),
    );

    try {
      await checkIn({ actor, employeeId, projectId, ...downtownCairo, accuracy: 10 });
      expect.unreachable('should have been refused');
    } catch (error) {
      const e = error as AttendanceError;
      expect(e.detail.distance).toBe(expected);
      expect(e.detail.site).toMatchObject({ lat: site.lat, lng: site.lng });
    }
  });

  it('ignores extra fields a client might invent to force acceptance', async () => {
    // A dishonest client posts what it wishes were true. `checkIn` takes
    // no `accepted` or `distance` input at all, so these are inert — the
    // call is still judged on its coordinates.
    await expect(
      checkIn({
        actor, employeeId, projectId,
        ...downtownCairo,
        accuracy: 5,
        // @ts-expect-error — deliberately posting fields the API does not accept
        accepted: true,
        distanceMetres: 0,
        status: 'ATTENDED',
      }),
    ).rejects.toMatchObject({ code: 'OUTSIDE_GEOFENCE' });
  });

  it('refuses a fix too coarse to distinguish inside from outside', async () => {
    // Standing exactly on the site, but the device only knows the position
    // to within 900m — which cannot mean "inside a 300m fence".
    await expect(
      checkIn({ actor, employeeId, projectId, latitude: site.lat, longitude: site.lng, accuracy: 900 }),
    ).rejects.toMatchObject({ code: 'IMPLAUSIBLE_ACCURACY' });
  });

  it('refuses a position outside Egypt', async () => {
    // A desktop browser falling back to an IP lookup in another country.
    await expect(
      checkIn({ actor, employeeId, projectId, latitude: 51.5074, longitude: -0.1278, accuracy: 20 }),
    ).rejects.toMatchObject({ code: 'OUT_OF_COUNTRY' });
  });

  it('refuses coordinates that are not points on Earth', async () => {
    for (const bad of [
      { latitude: 999, longitude: 31 },
      { latitude: 30, longitude: 999 },
      { latitude: Number.NaN, longitude: 31 },
    ]) {
      await expect(
        checkIn({ actor, employeeId, projectId, ...bad, accuracy: 10 }),
      ).rejects.toMatchObject({ code: 'INVALID_COORDINATES' });
    }
  });

  it('catches swapped latitude and longitude', async () => {
    // 31.49, 30.01 instead of 30.01, 31.49 — a classic bug, and one that
    // must not silently produce a plausible distance.
    await expect(
      checkIn({ actor, employeeId, projectId, latitude: site.lng, longitude: site.lat, accuracy: 10 }),
    ).rejects.toThrow(AttendanceError);
  });
});

describe('authorisation of the act itself', () => {
  it('refuses an employee not assigned to the project', async () => {
    await expect(
      checkIn({
        actor, employeeId: unassignedEmployeeId, projectId,
        latitude: site.lat, longitude: site.lng, accuracy: 10,
      }),
    ).rejects.toMatchObject({ code: 'NOT_ASSIGNED' });
  });

  it('checks assignment BEFORE revealing the distance to the site', async () => {
    // Someone not assigned should not be able to probe where a site is.
    try {
      await checkIn({
        actor, employeeId: unassignedEmployeeId, projectId,
        ...downtownCairo, accuracy: 10,
      });
      expect.unreachable('should have been refused');
    } catch (error) {
      const e = error as AttendanceError;
      expect(e.code).toBe('NOT_ASSIGNED');
      expect(e.detail.distance).toBeUndefined();
      expect(e.detail.site).toBeUndefined();
    }
  });

  it('refuses a project with no location pinned', async () => {
    const project = await db.project.findFirstOrThrow({
      where: { code: 'PRJ-0151' },
      select: { id: true, location: { select: { id: true } } },
    });
    const employee = await db.employee.findFirstOrThrow({ where: { code: 'EMP-005' }, select: { id: true } });

    // Temporarily remove the location, then restore it.
    const saved = await db.projectLocation.findUniqueOrThrow({ where: { id: project.location!.id } });
    await db.projectLocation.delete({ where: { id: saved.id } });

    try {
      await expect(
        checkIn({
          actor, employeeId: employee.id, projectId: project.id,
          latitude: 30.8418, longitude: 28.9536, accuracy: 10,
        }),
      ).rejects.toMatchObject({ code: 'NO_LOCATION' });
    } finally {
      await db.projectLocation.create({
        data: {
          projectId: saved.projectId, addressLine: saved.addressLine,
          governorateCode: saved.governorateCode, latitude: saved.latitude,
          longitude: saved.longitude, radiusMetres: saved.radiusMetres,
          siteType: saved.siteType,
        },
      });
    }
  });
});

describe('duplicates', () => {
  it('refuses a second check-in on the same Cairo day', async () => {
    await checkIn({ actor, employeeId, projectId, latitude: site.lat, longitude: site.lng, accuracy: 10 });

    await expect(
      checkIn({ actor, employeeId, projectId, latitude: site.lat, longitude: site.lng, accuracy: 10 }),
    ).rejects.toMatchObject({ code: 'ALREADY_CHECKED_IN' });

    expect(await db.attendance.count({ where: { projectId, employeeId } })).toBe(1);
  });

  it('holds under two simultaneous check-ins', async () => {
    // The unique index is the real defence, not the read-then-write.
    const results = await Promise.allSettled([
      checkIn({ actor, employeeId, projectId, latitude: site.lat, longitude: site.lng, accuracy: 10 }),
      checkIn({ actor, employeeId, projectId, latitude: site.lat, longitude: site.lng, accuracy: 10 }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.attendance.count({ where: { projectId, employeeId } })).toBe(1);
  });
});

describe('lateness', () => {
  it('marks a check-in after the threshold as LATE', async () => {
    // 09:30 Cairo, against an 08:00 start and a 15-minute grace.
    const at = new Date('2026-08-19T06:30:00.000Z'); // 09:30 EEST
    const result = await checkIn({
      actor, employeeId, projectId,
      latitude: site.lat, longitude: site.lng, accuracy: 10, at,
    });

    expect(result.attendance.status).toBe('LATE');
    expect(result.attendance.minutesLate).toBe(90);
  });

  it('marks a check-in inside the grace period as ATTENDED', async () => {
    // 08:10 Cairo — ten minutes late, inside the 15-minute threshold.
    const at = new Date('2026-08-19T05:10:00.000Z');
    const result = await checkIn({
      actor, employeeId, projectId,
      latitude: site.lat, longitude: site.lng, accuracy: 10, at,
    });

    expect(result.attendance.status).toBe('ATTENDED');
    expect(result.attendance.minutesLate).toBe(10);
  });
});

describe('check-out', () => {
  it('records worked minutes', async () => {
    const checkedInAt = new Date('2026-08-19T05:00:00.000Z'); // 08:00 Cairo
    await checkIn({
      actor, employeeId, projectId,
      latitude: site.lat, longitude: site.lng, accuracy: 10, at: checkedInAt,
    });

    const out = await checkOut({
      actor, employeeId, projectId,
      latitude: site.lat, longitude: site.lng,
      at: new Date('2026-08-19T13:30:00.000Z'), // 16:30 Cairo
    });

    expect(out.workedMinutes).toBe(510); // 8.5 hours
  });

  it('refuses a check-out with no check-in', async () => {
    await expect(
      checkOut({ actor, employeeId, projectId }),
    ).rejects.toMatchObject({ code: 'NOT_CHECKED_IN' });
  });

  it('refuses a second check-out', async () => {
    const at = new Date('2026-08-19T05:00:00.000Z');
    await checkIn({ actor, employeeId, projectId, latitude: site.lat, longitude: site.lng, accuracy: 10, at });
    await checkOut({ actor, employeeId, projectId, at: new Date('2026-08-19T13:00:00.000Z') });

    await expect(
      checkOut({ actor, employeeId, projectId, at: new Date('2026-08-19T14:00:00.000Z') }),
    ).rejects.toMatchObject({ code: 'ALREADY_CHECKED_OUT' });
  });
});

describe('Cairo time', () => {
  it('resolves the work date in Cairo, not the server zone', () => {
    // 22:30 UTC on the 19th is 00:30 on the 20th in Cairo (EEST, +03).
    // A server using its own date would file this under the wrong day.
    const late = new Date('2026-08-19T22:30:00.000Z');
    expect(cairoWorkDate(late).toISOString().slice(0, 10)).toBe('2026-08-20');
  });

  it('reads wall-clock minutes in Cairo', () => {
    // 05:00 UTC = 08:00 Cairo in summer = 480 minutes.
    expect(cairoMinutes(new Date('2026-08-19T05:00:00.000Z'))).toBe(480);
  });

  it('treats Friday and Saturday as the weekend', () => {
    expect(isCairoWeekend(new Date('2026-08-21T09:00:00.000Z'))).toBe(true);  // Friday
    expect(isCairoWeekend(new Date('2026-08-22T09:00:00.000Z'))).toBe(true);  // Saturday
    expect(isCairoWeekend(new Date('2026-08-23T09:00:00.000Z'))).toBe(false); // Sunday — a working day
  });
});

describe('read models', () => {
  it('lists only the sites an employee is assigned to', async () => {
    const sites = await assignedSites(employeeId);
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.every((s) => s.latitude && s.longitude && s.radiusMetres > 0)).toBe(true);

    const none = await assignedSites(unassignedEmployeeId);
    expect(none).toHaveLength(0);
  });

  it("reports today's record on the assigned site once checked in", async () => {
    await checkIn({ actor, employeeId, projectId, latitude: site.lat, longitude: site.lng, accuracy: 10 });

    const sites = await assignedSites(employeeId);
    const thisSite = sites.find((s) => s.projectId === projectId);
    expect(thisSite?.todayAttendance).not.toBeNull();
  });

  it('shows the roster with present and missing staff', async () => {
    await checkIn({ actor, employeeId, projectId, latitude: site.lat, longitude: site.lng, accuracy: 10 });

    // A Sunday, so absence genuinely means absence.
    const roster = await siteRoster(projectId, new Date('2026-08-23T09:00:00.000Z'));
    expect(roster.length).toBeGreaterThan(0);
    expect(roster.every((r) => r.employee.nameEn)).toBe(true);
  });
});

describe('audit', () => {
  it('records the raw claim alongside the accepted result', async () => {
    const result = await checkIn({
      actor, employeeId, projectId,
      latitude: site.lat, longitude: site.lng, accuracy: 8,
    });

    const entry = await db.auditLog.findFirstOrThrow({
      where: { action: 'CHECK_IN', entityId: result.attendance.id },
    });

    const after = entry.afterState as Record<string, unknown>;
    // Both what was claimed and what the server concluded, so a later
    // dispute can be settled from the record.
    expect(after.reportedLat).toBeDefined();
    expect(after.reportedAccuracy).toBe(8);
    expect(after.distanceMetres).toBe(result.attendance.distanceMetres);
    expect(after.radiusMetres).toBe(site.radius);
  });

  it('leaves no attendance row when a check-in is refused', async () => {
    const before = await db.attendance.count();
    await expect(
      checkIn({ actor, employeeId, projectId, ...downtownCairo, accuracy: 10 }),
    ).rejects.toThrow();
    expect(await db.attendance.count()).toBe(before);
  });
});
