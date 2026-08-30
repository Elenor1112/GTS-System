import 'server-only';

import { Prisma, type ProjectStatus } from '@prisma/client';

import { db, transaction } from '../db';
import { writeAudit, writeUpdateAudit } from './audit';
import { notifyProjectAssigned } from './notifications';
import { projectPosition } from './inventory';
import { nextCode } from './counters';
import { DomainError } from '../errors';

/**
 * GTS — projects.
 *
 * A project is where the whole system meets: a client owns it, employees
 * are assigned to it, materials are allocated to it, bills are raised
 * against it, and — crucially — it carries the ONE official location that
 * attendance is validated against.
 *
 * That location is administrator-controlled by design. An employee who
 * could set their own site coordinates could check in from anywhere.
 */

const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);

export class ProjectError extends DomainError {}

export interface ActorRef {
  id: string;
  email: string;
}

/* ============================================================
   LIST
   ============================================================ */

export async function listProjects(options: {
  search?: string;
  status?: ProjectStatus;
  clientId?: string;
} = {}) {
  const projects = await db.project.findMany({
    where: {
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(options.search
        ? {
            OR: [
              { nameEn: { contains: options.search, mode: 'insensitive' } },
              { code: { contains: options.search, mode: 'insensitive' } },
              { client: { nameEn: { contains: options.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: {
      id: true, code: true, nameEn: true, nameAr: true, status: true,
      startsOn: true, endsOn: true, budget: true,
      client: { select: { id: true, nameEn: true } },
      location: {
        select: { addressLine: true, latitude: true, longitude: true, radiusMetres: true },
      },
      _count: { select: { employees: true, products: true } },
      bills: {
        where: { deletedAt: null, status: { not: 'CANCELLED' } },
        select: { total: true },
      },
    },
    orderBy: [{ status: 'asc' }, { code: 'desc' }],
  });

  return projects.map((p) => {
    const billed = p.bills.reduce((sum, b) => sum.plus(D(b.total)), D(0));
    const budget = p.budget ? D(p.budget) : null;
    return {
      ...p,
      billed: billed.toDecimalPlaces(2),
      consumedPct:
        budget && budget.greaterThan(0)
          ? Math.round(billed.dividedBy(budget).times(100).toNumber())
          : null,
    };
  });
}

/* ============================================================
   DETAIL
   ============================================================ */

export async function projectDetail(projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      client: { select: { id: true, code: true, nameEn: true, trn: true } },
      location: true,
      employees: {
        select: {
          id: true, roleOnSite: true, assignedOn: true, releasedOn: true,
          employee: {
            select: {
              id: true, code: true, nameEn: true, jobTitleEn: true,
              department: true, dailyRate: true,
              user: { select: { id: true } },
            },
          },
        },
        orderBy: { assignedOn: 'desc' },
      },
      products: {
        select: {
          id: true, allocated: true, delivered: true, returned: true,
          damaged: true, agreedPrice: true,
          product: { select: { id: true, sku: true, nameEn: true, unit: true, salePrice: true } },
        },
      },
      bills: {
        where: { deletedAt: null },
        select: {
          id: true, number: true, status: true, issuedOn: true, dueOn: true,
          total: true, whtAmount: true, paidAmount: true,
        },
        orderBy: { issuedOn: 'desc' },
      },
    },
  });

  if (!project) return null;

  // Each product's position, computed by the same function the inventory
  // engine uses — so the page cannot disagree with the ledger.
  const products = project.products.map((row) => ({
    ...row,
    position: projectPosition(row),
  }));

  return { ...project, products };
}

/* ============================================================
   MUTATIONS
   ============================================================ */

export interface ProjectInput {
  /** Omitted on create — the server assigns the next PRJ-0001-style code. */
  code?: string;
  nameEn: string;
  nameAr?: string | null;
  clientId: string;
  status?: ProjectStatus;
  startsOn?: Date | null;
  endsOn?: Date | null;
  budget?: number | string | null;
  notes?: string | null;
}

export async function createProject(params: { actor: ActorRef; input: ProjectInput }) {
  const { input, actor } = params;

  const client = await db.client.findFirst({
    where: { id: input.clientId, deletedAt: null },
    select: { id: true, nameEn: true },
  });
  if (!client) throw new ProjectError('CLIENT_NOT_FOUND', 'That client does not exist.');

  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) {
    throw new ProjectError('INVALID_DATES', 'The end date cannot fall before the start date.');
  }

  const project = await transaction(async (tx) => {
    const code = input.code ?? (await nextCode(tx, 'project'));
    return tx.project.create({
      data: {
        code,
        nameEn: input.nameEn,
        nameAr: input.nameAr ?? null,
        clientId: input.clientId,
        status: input.status ?? 'PLANNING',
        startsOn: input.startsOn ?? null,
        endsOn: input.endsOn ?? null,
        budget: input.budget != null ? D(input.budget) : null,
        notes: input.notes ?? null,
      },
    });
  });

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'CREATE',
    entityType: 'Project',
    entityId: project.id,
    summary: `Created project ${project.code} for ${client.nameEn}`,
    afterState: { code: project.code, nameEn: project.nameEn, client: client.nameEn },
  });

  return project;
}

export async function updateProject(params: {
  actor: ActorRef;
  projectId: string;
  input: Partial<ProjectInput>;
}) {
  const before = await db.project.findFirst({
    where: { id: params.projectId, deletedAt: null },
  });
  if (!before) throw new ProjectError('NOT_FOUND', 'That project does not exist.');

  const startsOn = params.input.startsOn ?? before.startsOn;
  const endsOn = params.input.endsOn ?? before.endsOn;
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new ProjectError('INVALID_DATES', 'The end date cannot fall before the start date.');
  }

  if (params.input.code && params.input.code !== before.code) {
    const clash = await db.project.findFirst({
      where: { deletedAt: null, code: params.input.code, id: { not: params.projectId } },
      select: { id: true },
    });
    if (clash) throw new ProjectError('DUPLICATE', `Project code ${params.input.code} is already in use.`);
  }

  const after = await db.project.update({
    where: { id: params.projectId },
    data: {
      ...(params.input.code !== undefined ? { code: params.input.code } : {}),
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(params.input.status !== undefined ? { status: params.input.status } : {}),
      ...(params.input.startsOn !== undefined ? { startsOn: params.input.startsOn } : {}),
      ...(params.input.endsOn !== undefined ? { endsOn: params.input.endsOn } : {}),
      ...(params.input.budget !== undefined
        ? { budget: params.input.budget != null ? D(params.input.budget) : null }
        : {}),
      ...(params.input.notes !== undefined ? { notes: params.input.notes } : {}),
    },
  });

  await writeUpdateAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    entityType: 'Project',
    entityId: after.id,
    summary: `Updated project ${after.code}`,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after;
}

/* ============================================================
   THE SITE LOCATION — the geofence

   Its own function, its own permission (`projects.location`) and its
   own audit action, because moving a site boundary changes who can
   record attendance and from where. That is a security event, not a
   detail of editing a project.
   ============================================================ */

export interface LocationInput {
  addressLine: string;
  governorateCode: number;
  latitude: number;
  longitude: number;
  radiusMetres: number;
  siteType?: string;
}

export async function setProjectLocation(params: {
  actor: ActorRef;
  projectId: string;
  input: LocationInput;
}) {
  const { input } = params;

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new ProjectError('INVALID_COORDINATES', 'Enter a valid latitude and longitude.');
  }
  if (input.latitude < -90 || input.latitude > 90) {
    throw new ProjectError('INVALID_COORDINATES', 'Latitude must be between −90 and 90.');
  }
  if (input.longitude < -180 || input.longitude > 180) {
    throw new ProjectError('INVALID_COORDINATES', 'Longitude must be between −180 and 180.');
  }
  // Mirrors the CHECK constraint, so the message is a sentence rather
  // than a constraint violation.
  if (input.radiusMetres < 25 || input.radiusMetres > 5000) {
    throw new ProjectError(
      'INVALID_RADIUS',
      'The check-in radius must be between 25m and 5km. Below 25m, ordinary GPS drift locks people out; above 5km it stops being a site boundary.',
    );
  }

  const project = await db.project.findFirst({
    where: { id: params.projectId, deletedAt: null },
    select: { id: true, code: true, location: true },
  });
  if (!project) throw new ProjectError('NOT_FOUND', 'That project does not exist.');

  const before = project.location;

  const location = await db.projectLocation.upsert({
    where: { projectId: params.projectId },
    create: {
      projectId: params.projectId,
      addressLine: input.addressLine,
      governorateCode: input.governorateCode,
      latitude: D(input.latitude),
      longitude: D(input.longitude),
      radiusMetres: input.radiusMetres,
      siteType: input.siteType ?? 'site',
    },
    update: {
      addressLine: input.addressLine,
      governorateCode: input.governorateCode,
      latitude: D(input.latitude),
      longitude: D(input.longitude),
      radiusMetres: input.radiusMetres,
      ...(input.siteType ? { siteType: input.siteType } : {}),
    },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'LOCATION_CHANGE',
    entityType: 'ProjectLocation',
    entityId: location.id,
    summary: before
      ? `Moved the site boundary for ${project.code}`
      : `Set the site location for ${project.code}`,
    beforeState: before
      ? {
          addressLine: before.addressLine,
          latitude: before.latitude.toString(),
          longitude: before.longitude.toString(),
          radiusMetres: before.radiusMetres,
        }
      : null,
    afterState: {
      addressLine: location.addressLine,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radiusMetres: location.radiusMetres,
    },
  });

  return location;
}

/* ============================================================
   ASSIGNMENTS
   ============================================================ */

export async function assignEmployee(params: {
  actor: ActorRef;
  projectId: string;
  employeeId: string;
  roleOnSite?: string | null;
  assignedOn?: Date;
}) {
  const assignedOn =
    params.assignedOn ??
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  const [project, employee] = await Promise.all([
    db.project.findFirst({
      where: { id: params.projectId, deletedAt: null },
      select: { id: true, code: true, nameEn: true, status: true, location: { select: { id: true } } },
    }),
    db.employee.findFirst({
      where: { id: params.employeeId, deletedAt: null },
      select: { id: true, nameEn: true, isActive: true, user: { select: { id: true } } },
    }),
  ]);

  if (!project) throw new ProjectError('NOT_FOUND', 'That project does not exist.');
  if (!employee) throw new ProjectError('EMPLOYEE_NOT_FOUND', 'That employee does not exist.');
  if (!employee.isActive) {
    throw new ProjectError('EMPLOYEE_INACTIVE', `${employee.nameEn} is not an active employee.`);
  }
  if (project.status === 'COMPLETED' || project.status === 'CANCELLED') {
    throw new ProjectError(
      'PROJECT_CLOSED',
      `${project.code} is ${project.status.toLowerCase()}; nobody can be assigned to it.`,
    );
  }

  const existing = await db.projectEmployee.findFirst({
    where: { projectId: params.projectId, employeeId: params.employeeId, releasedOn: null },
    select: { id: true },
  });
  if (existing) {
    throw new ProjectError(
      'ALREADY_ASSIGNED',
      `${employee.nameEn} is already assigned to ${project.code}.`,
    );
  }

  const assignment = await db.projectEmployee.create({
    data: {
      projectId: params.projectId,
      employeeId: params.employeeId,
      roleOnSite: params.roleOnSite ?? null,
      assignedOn,
    },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'CREATE',
    entityType: 'ProjectEmployee',
    entityId: assignment.id,
    summary: `Assigned ${employee.nameEn} to ${project.code}`,
    afterState: { project: project.code, employee: employee.nameEn, roleOnSite: params.roleOnSite },
  });

  // Only worth telling them if they have a login to be told through.
  if (employee.user) {
    await notifyProjectAssigned({
      projectId: project.id,
      projectName: project.nameEn,
      userId: employee.user.id,
    });
  }

  return { assignment, hasLocation: Boolean(project.location) };
}

export async function releaseEmployee(params: {
  actor: ActorRef;
  assignmentId: string;
  releasedOn?: Date;
}) {
  const assignment = await db.projectEmployee.findUnique({
    where: { id: params.assignmentId },
    select: {
      id: true, releasedOn: true, assignedOn: true,
      project: { select: { code: true } },
      employee: { select: { nameEn: true } },
    },
  });
  if (!assignment) throw new ProjectError('NOT_FOUND', 'That assignment does not exist.');
  if (assignment.releasedOn) {
    throw new ProjectError('ALREADY_RELEASED', 'That assignment has already ended.');
  }

  const releasedOn =
    params.releasedOn ??
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  if (releasedOn < assignment.assignedOn) {
    throw new ProjectError('INVALID_DATE', 'An assignment cannot end before it began.');
  }

  const released = await db.projectEmployee.update({
    where: { id: params.assignmentId },
    data: { releasedOn },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'UPDATE',
    entityType: 'ProjectEmployee',
    entityId: released.id,
    summary: `Released ${assignment.employee.nameEn} from ${assignment.project.code}`,
    afterState: { releasedOn: releasedOn.toISOString().slice(0, 10) },
  });

  return released;
}

/* ============================================================
   ARCHIVE
   ============================================================ */

export async function archiveProject(params: { actor: ActorRef; projectId: string }) {
  const project = await db.project.findFirst({
    where: { id: params.projectId, deletedAt: null },
    select: {
      id: true, code: true, nameEn: true,
      bills: {
        where: { deletedAt: null, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { number: true },
      },
      products: { select: { allocated: true, delivered: true, returned: true, damaged: true } },
    },
  });
  if (!project) throw new ProjectError('NOT_FOUND', 'That project does not exist.');

  if (project.bills.length > 0) {
    throw new ProjectError(
      'HAS_OPEN_BILLS',
      `${project.code} has ${project.bills.length} unpaid bill${project.bills.length === 1 ? '' : 's'}.`,
    );
  }

  // Material still on site is material nobody has accounted for.
  const outstanding = project.products.reduce((sum, p) => {
    const position = projectPosition(p);
    return sum.plus(position.remaining).plus(position.inTransit);
  }, D(0));

  if (outstanding.greaterThan(0)) {
    throw new ProjectError(
      'MATERIAL_OUTSTANDING',
      `${outstanding.toString()} units are still allocated to ${project.code}. Return or write them off first.`,
    );
  }

  const archived = await db.project.update({
    where: { id: params.projectId },
    data: { deletedAt: new Date(), status: 'CANCELLED' },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'DELETE',
    entityType: 'Project',
    entityId: archived.id,
    summary: `Archived project ${archived.code}`,
  });

  return archived;
}
