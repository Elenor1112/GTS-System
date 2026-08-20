import 'server-only';

import { Prisma, type AttendanceStatus } from '@prisma/client';

import { db, transaction } from '../db';
import { writeAudit } from './audit';
import { evaluate, type GeofenceResult, MAX_ACCURACY_M } from '../geofence';
import { getSetting } from './settings';
import { DomainError } from '../errors';

/**
 * GTS — attendance with server-side geofence validation.
 *
 * THE RULE: a coordinate pair from a browser is a claim, not a fact.
 *
 * The client shows the employee how far away they are so the screen is
 * useful, but that calculation decides nothing. This module re-runs the
 * same Haversine evaluation server-side, against the project location an
 * ADMINISTRATOR set, and writes the record only if the server's own
 * verdict accepts it. A caller that posts `{ accepted: true, distance: 0 }`
 * is ignored — those fields do not exist in the input at all.
 */

const D = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v);

export class AttendanceError extends DomainError {}

/* ============================================================
   CAIRO TIME

   The unique constraint is (employee, project, workDate), and
   `workDate` must be the date a HUMAN means by "today" — which is the
   date in Cairo, not in whatever zone the server happens to run.
   ============================================================ */

const TZ = 'Africa/Cairo';

/** The Cairo calendar date of an instant, as a DATE-comparable UTC midnight. */
export function cairoWorkDate(at: Date): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at);
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Wall-clock minutes since midnight in Cairo. */
export function cairoMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** Friday (5) and Saturday (6) are the Egyptian weekend. */
export function isCairoWeekend(at: Date): boolean {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(at);
  return name === 'Fri' || name === 'Sat';
}

/** "08:00" → 480 minutes past midnight. Exported so the dashboard
 *  can decide whether the working day has started yet. */
export function parseHhMm(value: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/* ============================================================
   STATES — what the UI renders
   ============================================================ */

export type AttendanceUiState =
  | 'NOT_STARTED'
  | 'LOCATION_PERMISSION_REQUIRED'
  | 'OUTSIDE_GEOFENCE'
  | 'INSIDE_GEOFENCE'
  | 'ATTENDED'
  | 'LATE'
  | 'MISSED';

/* ============================================================
   ASSIGNED SITES
   ============================================================ */

export interface AssignedSite {
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  radiusMetres: number;
  siteType: string;
  /** Today's record, if the employee has already checked in. */
  todayAttendance: {
    id: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    status: AttendanceStatus;
    minutesLate: number;
    distanceMetres: number;
  } | null;
}

/**
 * The sites this employee may check in at today.
 *
 * Only live assignments on projects that are actually running, and only
 * projects that have a location pinned — a project without coordinates
 * has no fence to be inside of.
 */
export async function assignedSites(employeeId: string, at = new Date()): Promise<AssignedSite[]> {
  const workDate = cairoWorkDate(at);

  const assignments = await db.projectEmployee.findMany({
    where: {
      employeeId,
      OR: [{ releasedOn: null }, { releasedOn: { gte: workDate } }],
      project: {
        deletedAt: null,
        status: { in: ['ACTIVE', 'PLANNING'] },
        location: { isNot: null },
      },
    },
    select: {
      project: {
        select: {
          id: true, code: true, nameEn: true,
          client: { select: { nameEn: true } },
          location: true,
          attendance: {
            where: { employeeId, workDate },
            select: {
              id: true, checkInAt: true, checkOutAt: true,
              status: true, minutesLate: true, distanceMetres: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  return assignments
    .filter((a) => a.project.location)
    .map((a) => ({
      projectId: a.project.id,
      projectCode: a.project.code,
      projectName: a.project.nameEn,
      clientName: a.project.client.nameEn,
      addressLine: a.project.location!.addressLine,
      latitude: Number(a.project.location!.latitude),
      longitude: Number(a.project.location!.longitude),
      radiusMetres: a.project.location!.radiusMetres,
      siteType: a.project.location!.siteType,
      todayAttendance: a.project.attendance[0] ?? null,
    }));
}

/* ============================================================
   CHECK IN
   ============================================================ */

export interface CheckInInput {
  actor: { id: string; email: string };
  employeeId: string;
  projectId: string;
  /** The device's reported position. Treated as a claim throughout. */
  latitude: number;
  longitude: number;
  /** The browser's own uncertainty in metres, if it reported one. */
  accuracy?: number | null;
  at?: Date;
  notes?: string | null;
}

export interface CheckInResult {
  attendance: {
    id: string;
    status: AttendanceStatus;
    checkInAt: Date;
    distanceMetres: number;
    minutesLate: number;
  };
  geofence: GeofenceResult;
}

/**
 * Record a check-in, if and only if the server's own geofence accepts it.
 *
 * Order matters: assignment first, then the fence, then the duplicate
 * check — so an unassigned employee is told they are not assigned rather
 * than being told their distance from a site they have no business at.
 */
export async function checkIn(input: CheckInInput): Promise<CheckInResult> {
  const at = input.at ?? new Date();

  // A pair of numbers from a request body could be anything.
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new AttendanceError('INVALID_COORDINATES', 'No usable position was supplied.');
  }
  if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
    throw new AttendanceError('INVALID_COORDINATES', 'Those coordinates are not a point on Earth.');
  }

  const assignment = await db.projectEmployee.findFirst({
    where: {
      employeeId: input.employeeId,
      projectId: input.projectId,
      OR: [{ releasedOn: null }, { releasedOn: { gte: cairoWorkDate(at) } }],
    },
    select: { id: true },
  });
  if (!assignment) {
    throw new AttendanceError(
      'NOT_ASSIGNED',
      'You are not assigned to this project, so you cannot check in here.',
    );
  }

  const project = await db.project.findFirst({
    where: { id: input.projectId, deletedAt: null },
    select: { id: true, code: true, nameEn: true, status: true, location: true },
  });
  if (!project) throw new AttendanceError('PROJECT_NOT_FOUND', 'That project does not exist.');
  if (!project.location) {
    throw new AttendanceError(
      'NO_LOCATION',
      `${project.code} has no site location set. An administrator must pin it before anyone can check in.`,
    );
  }
  if (project.status !== 'ACTIVE' && project.status !== 'PLANNING') {
    throw new AttendanceError('PROJECT_CLOSED', `${project.code} is ${project.status.toLowerCase()}.`);
  }

  /* ---- THE SERVER'S OWN VERDICT ----
     Computed from the fence the administrator set and the coordinates as
     received. Nothing the client calculated is consulted. */
  const fence = {
    lat: Number(project.location.latitude),
    lng: Number(project.location.longitude),
    radius: project.location.radiusMetres,
  };

  const maxAccuracy = await getSetting('attendance.maxAccuracyMetres', MAX_ACCURACY_M);
  const accuracy = input.accuracy ?? undefined;

  const verdict = evaluate(fence, { lat: input.latitude, lng: input.longitude }, accuracy);

  if (accuracy !== undefined && accuracy > maxAccuracy) {
    throw new AttendanceError(
      'IMPLAUSIBLE_ACCURACY',
      `Your position is only accurate to ${Math.round(accuracy)}m, which cannot tell inside the site from outside. Move into the open and try again.`,
      { accuracy, maxAccuracy, distance: verdict.distance },
    );
  }

  if (!verdict.accepted) {
    // The refusal carries the distance so the screen can show it and
    // offer navigation, rather than saying a bare "denied".
    throw new AttendanceError(
      verdict.verdict === 'OUT_OF_COUNTRY' ? 'OUT_OF_COUNTRY' : 'OUTSIDE_GEOFENCE',
      verdict.verdict === 'OUT_OF_COUNTRY'
        ? 'That position is outside Egypt. Check that location services are using GPS rather than your network.'
        : `You are ${verdict.distance}m from ${project.nameEn}; check-in opens within ${fence.radius}m.`,
      {
        distance: verdict.distance,
        overshoot: verdict.overshoot,
        radius: fence.radius,
        verdict: verdict.verdict,
        site: { lat: fence.lat, lng: fence.lng, name: project.nameEn },
      },
    );
  }

  /* ---- Lateness, against the administrator's configured hours ---- */
  const workStart = parseHhMm(await getSetting('attendance.workStart', '08:00'), 8 * 60);
  const threshold = await getSetting('attendance.lateThresholdMinutes', 15);
  const minutesNow = cairoMinutes(at);
  const minutesLate = Math.max(0, minutesNow - workStart);
  const status: AttendanceStatus = minutesLate > threshold ? 'LATE' : 'ATTENDED';

  const workDate = cairoWorkDate(at);

  const attendance = await transaction(async (tx) => {
    // The unique index (employeeId, projectId, workDate) is the real
    // duplicate defence; this read only produces a better message.
    const existing = await tx.attendance.findUnique({
      where: {
        employeeId_projectId_workDate: {
          employeeId: input.employeeId,
          projectId: input.projectId,
          workDate,
        },
      },
      select: { id: true, checkInAt: true },
    });
    if (existing) {
      throw new AttendanceError(
        'ALREADY_CHECKED_IN',
        'You have already checked in at this site today.',
        { attendanceId: existing.id, checkInAt: existing.checkInAt.toISOString() },
      );
    }

    const created = await tx.attendance.create({
      data: {
        employeeId: input.employeeId,
        projectId: input.projectId,
        workDate,
        checkInAt: at,
        checkInLat: D(input.latitude),
        checkInLng: D(input.longitude),
        checkInAccuracy: accuracy != null ? D(accuracy) : null,
        // The SERVER's distance, and the radius that was in force at this
        // moment — widening the fence later must not retroactively
        // legitimise a check-in that was refused today.
        distanceMetres: verdict.distance,
        radiusAtCheckIn: fence.radius,
        status,
        minutesLate,
        notes: input.notes ?? null,
      },
    });

    await writeAudit(
      {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        action: 'CHECK_IN',
        entityType: 'Attendance',
        entityId: created.id,
        summary: `Checked in at ${project.code}, ${verdict.distance}m from site`,
        afterState: {
          project: project.code,
          distanceMetres: verdict.distance,
          radiusMetres: fence.radius,
          status,
          minutesLate,
          // The raw claim is retained for audit even though it was accepted.
          reportedLat: input.latitude,
          reportedLng: input.longitude,
          reportedAccuracy: accuracy ?? null,
        },
      },
      tx,
    );

    return created;
  });

  return {
    attendance: {
      id: attendance.id,
      status: attendance.status,
      checkInAt: attendance.checkInAt,
      distanceMetres: attendance.distanceMetres,
      minutesLate: attendance.minutesLate,
    },
    geofence: verdict,
  };
}

/* ============================================================
   CHECK OUT
   ============================================================ */

export async function checkOut(input: {
  actor: { id: string; email: string };
  employeeId: string;
  projectId: string;
  latitude?: number | null;
  longitude?: number | null;
  at?: Date;
}) {
  const at = input.at ?? new Date();
  const workDate = cairoWorkDate(at);

  return transaction(async (tx) => {
    const record = await tx.attendance.findUnique({
      where: {
        employeeId_projectId_workDate: {
          employeeId: input.employeeId,
          projectId: input.projectId,
          workDate,
        },
      },
    });
    if (!record) {
      throw new AttendanceError('NOT_CHECKED_IN', 'You have not checked in at this site today.');
    }
    if (record.checkOutAt) {
      throw new AttendanceError('ALREADY_CHECKED_OUT', 'You have already checked out today.');
    }
    if (at < record.checkInAt) {
      throw new AttendanceError('CHECKOUT_BEFORE_CHECKIN', 'Check-out cannot precede check-in.');
    }

    const workedMinutes = Math.round((at.getTime() - record.checkInAt.getTime()) / 60_000);

    const updated = await tx.attendance.update({
      where: { id: record.id },
      data: {
        checkOutAt: at,
        checkOutLat: input.latitude != null ? D(input.latitude) : null,
        checkOutLng: input.longitude != null ? D(input.longitude) : null,
        workedMinutes,
      },
    });

    await writeAudit(
      {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        action: 'CHECK_OUT',
        entityType: 'Attendance',
        entityId: record.id,
        summary: `Checked out after ${(workedMinutes / 60).toFixed(1)}h`,
        afterState: { workedMinutes, checkOutAt: at.toISOString() },
      },
      tx,
    );

    return updated;
  });
}

/* ============================================================
   READ MODELS
   ============================================================ */

/** One employee's attendance over a date range. */
export async function attendanceFor(
  employeeId: string,
  from: Date,
  to: Date,
) {
  return db.attendance.findMany({
    where: { employeeId, workDate: { gte: cairoWorkDate(from), lte: cairoWorkDate(to) } },
    orderBy: { workDate: 'desc' },
    include: { project: { select: { code: true, nameEn: true } } },
  });
}

/** Everyone's attendance at one project on one day — the site roster. */
export async function siteRoster(projectId: string, at = new Date()) {
  const workDate = cairoWorkDate(at);

  const [assigned, present] = await Promise.all([
    db.projectEmployee.findMany({
      where: {
        projectId,
        OR: [{ releasedOn: null }, { releasedOn: { gte: workDate } }],
      },
      select: {
        roleOnSite: true,
        employee: { select: { id: true, code: true, nameEn: true, jobTitleEn: true } },
      },
    }),
    db.attendance.findMany({
      where: { projectId, workDate },
      select: {
        employeeId: true, checkInAt: true, checkOutAt: true,
        status: true, minutesLate: true, distanceMetres: true,
      },
    }),
  ]);

  const byEmployee = new Map(present.map((p) => [p.employeeId, p]));
  const weekend = isCairoWeekend(at);

  return assigned.map((a) => {
    const record = byEmployee.get(a.employee.id) ?? null;
    return {
      employee: a.employee,
      roleOnSite: a.roleOnSite,
      attendance: record,
      // Absence only means something on a working day — Friday and
      // Saturday are the weekend, not a no-show.
      state: record
        ? (record.status as AttendanceUiState)
        : weekend
          ? ('NOT_STARTED' as AttendanceUiState)
          : ('MISSED' as AttendanceUiState),
    };
  });
}

/** Attendance summary for a project over a range — used by reports. */
export async function attendanceSummary(params: {
  projectId?: string;
  employeeId?: string;
  from: Date;
  to: Date;
}) {
  const where = {
    workDate: { gte: cairoWorkDate(params.from), lte: cairoWorkDate(params.to) },
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.employeeId ? { employeeId: params.employeeId } : {}),
  };

  const [total, late, byStatus, worked] = await Promise.all([
    db.attendance.count({ where }),
    db.attendance.count({ where: { ...where, status: 'LATE' } }),
    db.attendance.groupBy({ by: ['status'], where, _count: true }),
    db.attendance.aggregate({ where, _sum: { workedMinutes: true } }),
  ]);

  return {
    total,
    late,
    onTime: total - late,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    hoursWorked: Number(((worked._sum.workedMinutes ?? 0) / 60).toFixed(1)),
  };
}
