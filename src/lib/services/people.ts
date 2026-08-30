import 'server-only';

import { Prisma } from '@prisma/client';

import { db, transaction } from '../db';
import { DomainError } from '../errors';
import { hashPassword, destroyAllSessions } from '../auth';
import { writeAudit, writeUpdateAudit } from './audit';
import { nextCode } from './counters';
import { ADMIN_ROLE, PERMISSION_KEYS, type PermissionKey } from '../permissions';

/**
 * GTS — users, employees and roles.
 *
 * The authorization surface itself. Two rules run through everything
 * here, because getting either wrong locks people out of their own
 * system:
 *
 *   1. The last administrator cannot be demoted, deactivated or deleted.
 *   2. The administrator ROLE cannot have permissions taken from it —
 *      it holds them implicitly, and editing it would be a no-op that
 *      looks like it worked.
 */

export class PeopleError extends DomainError {}

export interface ActorRef {
  id: string;
  email: string;
}

/* ============================================================
   USERS
   ============================================================ */

export async function listUsers(options: { includeInactive?: boolean } = {}) {
  return db.user.findMany({
    where: {
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    select: {
      id: true, email: true, nameEn: true, nameAr: true,
      phone: true, isActive: true, lastLoginAt: true, createdAt: true,
      role: { select: { id: true, key: true, nameEn: true } },
      employee: { select: { id: true, code: true, jobTitleEn: true, department: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: { nameEn: 'asc' },
  });
}

/** How many administrators can still sign in. */
async function activeAdminCount(excludeUserId?: string): Promise<number> {
  return db.user.count({
    where: {
      deletedAt: null,
      isActive: true,
      role: { key: ADMIN_ROLE },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export interface UserInput {
  email: string;
  nameEn: string;
  nameAr?: string | null;
  phone?: string | null;
  roleId: string;
  password?: string;
}

export async function createUser(params: { actor: ActorRef; input: UserInput }) {
  const { input, actor } = params;

  if (!input.password || input.password.length < 12) {
    throw new PeopleError('WEAK_PASSWORD', 'Set a password of at least 12 characters.');
  }

  const clash = await db.user.findFirst({
    where: { deletedAt: null, email: input.email },
    select: { id: true },
  });
  if (clash) throw new PeopleError('DUPLICATE', `${input.email} already has an account.`);

  const role = await db.role.findUnique({ where: { id: input.roleId }, select: { id: true, nameEn: true } });
  if (!role) throw new PeopleError('ROLE_NOT_FOUND', 'That role does not exist.');

  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      nameEn: input.nameEn,
      nameAr: input.nameAr ?? null,
      phone: input.phone ?? null,
      roleId: input.roleId,
    },
  });

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    summary: `Created user ${user.email} as ${role.nameEn}`,
    afterState: { email: user.email, nameEn: user.nameEn, role: role.nameEn },
  });

  return user;
}

export async function updateUser(params: {
  actor: ActorRef;
  userId: string;
  input: Partial<Omit<UserInput, 'password'>>;
}) {
  const before = await db.user.findFirst({
    where: { id: params.userId, deletedAt: null },
    include: { role: { select: { key: true, nameEn: true } } },
  });
  if (!before) throw new PeopleError('NOT_FOUND', 'That user does not exist.');

  /* ---- The last administrator keeps their role ---- */
  if (params.input.roleId && params.input.roleId !== before.roleId) {
    const newRole = await db.role.findUnique({
      where: { id: params.input.roleId },
      select: { key: true, nameEn: true },
    });
    if (!newRole) throw new PeopleError('ROLE_NOT_FOUND', 'That role does not exist.');

    const losingAdmin = before.role.key === ADMIN_ROLE && newRole.key !== ADMIN_ROLE;
    if (losingAdmin && (await activeAdminCount(params.userId)) === 0) {
      throw new PeopleError(
        'LAST_ADMIN',
        `${before.nameEn} is the only administrator. Promote somebody else before changing this role, or nobody can administer the system.`,
      );
    }
  }

  const after = await db.user.update({
    where: { id: params.userId },
    data: {
      ...(params.input.email !== undefined ? { email: params.input.email } : {}),
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(params.input.phone !== undefined ? { phone: params.input.phone } : {}),
      ...(params.input.roleId !== undefined ? { roleId: params.input.roleId } : {}),
    },
    include: { role: { select: { nameEn: true } } },
  });

  await writeUpdateAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    entityType: 'User',
    entityId: after.id,
    summary: `Updated user ${after.email}`,
    before: { ...before, role: before.role.nameEn } as unknown as Record<string, unknown>,
    after: { ...after, role: after.role.nameEn } as unknown as Record<string, unknown>,
  });

  return after;
}

/**
 * Deactivate a user.
 *
 * Not deletion: their audit entries, approvals and attendance stay
 * attributable. Active sessions are ended immediately — a deactivation
 * that leaves somebody signed in until their cookie expires is not a
 * deactivation.
 */
export async function setUserActive(params: {
  actor: ActorRef;
  userId: string;
  isActive: boolean;
}) {
  const user = await db.user.findFirst({
    where: { id: params.userId, deletedAt: null },
    include: { role: { select: { key: true } } },
  });
  if (!user) throw new PeopleError('NOT_FOUND', 'That user does not exist.');

  if (!params.isActive) {
    if (user.id === params.actor.id) {
      throw new PeopleError('SELF_DEACTIVATE', 'You cannot deactivate your own account.');
    }
    if (user.role.key === ADMIN_ROLE && (await activeAdminCount(user.id)) === 0) {
      throw new PeopleError(
        'LAST_ADMIN',
        `${user.nameEn} is the only active administrator. Promote somebody else first.`,
      );
    }
  }

  const updated = await db.user.update({
    where: { id: params.userId },
    data: { isActive: params.isActive },
  });

  if (!params.isActive) await destroyAllSessions(params.userId);

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'UPDATE',
    entityType: 'User',
    entityId: updated.id,
    summary: `${params.isActive ? 'Reactivated' : 'Deactivated'} ${updated.email}`,
    beforeState: { isActive: user.isActive },
    afterState: { isActive: params.isActive },
  });

  return updated;
}

/** Set somebody else's password — an administrative reset. */
export async function resetPassword(params: {
  actor: ActorRef;
  userId: string;
  password: string;
}) {
  if (params.password.length < 12) {
    throw new PeopleError('WEAK_PASSWORD', 'Use at least 12 characters.');
  }

  const user = await db.user.findFirst({
    where: { id: params.userId, deletedAt: null },
    select: { id: true, email: true },
  });
  if (!user) throw new PeopleError('NOT_FOUND', 'That user does not exist.');

  await db.user.update({
    where: { id: params.userId },
    data: { passwordHash: await hashPassword(params.password) },
  });

  // Every device is signed out: a reset is what happens when an account
  // may be compromised.
  await destroyAllSessions(params.userId);

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'PASSWORD_CHANGE',
    entityType: 'User',
    entityId: user.id,
    summary: `Reset the password for ${user.email} and signed out every device`,
  });

  return { reset: true as const };
}

/* ============================================================
   ROLES & PERMISSIONS
   ============================================================ */

export async function listRoles() {
  const roles = await db.role.findMany({
    select: {
      id: true, key: true, nameEn: true, nameAr: true,
      description: true, isSystem: true,
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
    },
    orderBy: [{ isSystem: 'desc' }, { nameEn: 'asc' }],
  });

  return roles.map((role) => ({
    ...role,
    // The administrator holds every permission implicitly, so the matrix
    // must show them all rather than the empty row the table contains.
    permissionKeys:
      role.key === ADMIN_ROLE
        ? [...PERMISSION_KEYS]
        : role.permissions.map((p) => p.permission.key),
    holdsAllImplicitly: role.key === ADMIN_ROLE,
  }));
}

export async function listPermissions() {
  return db.permission.findMany({
    select: { id: true, key: true, module: true, action: true, description: true },
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });
}

/**
 * Replace a role's permissions.
 *
 * The administrator role is refused outright rather than silently
 * ignored: it holds every permission through `can()`, so "saving" a
 * reduced set would appear to work and change nothing — the worst
 * possible outcome for a security screen.
 */
export async function setRolePermissions(params: {
  actor: ActorRef;
  roleId: string;
  permissionKeys: string[];
}) {
  const role = await db.role.findUnique({
    where: { id: params.roleId },
    select: {
      id: true, key: true, nameEn: true, isSystem: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!role) throw new PeopleError('NOT_FOUND', 'That role does not exist.');

  if (role.key === ADMIN_ROLE) {
    throw new PeopleError(
      'ADMIN_ROLE_FIXED',
      'The administrator role holds every permission implicitly and cannot be edited. Create a separate role if somebody needs narrower access.',
    );
  }

  const unknown = params.permissionKeys.filter(
    (key) => !PERMISSION_KEYS.includes(key as PermissionKey),
  );
  if (unknown.length > 0) {
    throw new PeopleError('UNKNOWN_PERMISSION', `Unrecognised permission: ${unknown.join(', ')}.`);
  }

  const permissions = await db.permission.findMany({
    where: { key: { in: params.permissionKeys } },
    select: { id: true, key: true },
  });

  const before = role.permissions.map((p) => p.permission.key).sort();
  const after = permissions.map((p) => p.key).sort();

  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId: role.id } }),
    db.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'PERMISSION_CHANGE',
    entityType: 'Role',
    entityId: role.id,
    summary: `Changed the permissions on ${role.nameEn}`,
    beforeState: { permissions: before },
    afterState: {
      permissions: after,
      granted: after.filter((k) => !before.includes(k)),
      revoked: before.filter((k) => !after.includes(k)),
    },
  });

  return { count: after.length };
}

export async function createRole(params: {
  actor: ActorRef;
  input: { key: string; nameEn: string; nameAr?: string | null; description?: string | null };
}) {
  const clash = await db.role.findUnique({ where: { key: params.input.key }, select: { id: true } });
  if (clash) throw new PeopleError('DUPLICATE', `A role with the key ${params.input.key} exists.`);

  const role = await db.role.create({
    data: {
      key: params.input.key,
      nameEn: params.input.nameEn,
      nameAr: params.input.nameAr ?? null,
      description: params.input.description ?? null,
      isSystem: false,
    },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'CREATE',
    entityType: 'Role',
    entityId: role.id,
    summary: `Created role ${role.nameEn}`,
  });

  return role;
}

/* ============================================================
   EMPLOYEES
   ============================================================ */

export async function listEmployees(options: {
  search?: string;
  jobTitle?: string;
  department?: string;
  /** Working on this project right now — a released assignment doesn't count. */
  projectId?: string;
  includeInactive?: boolean;
} = {}) {
  return db.employee.findMany({
    where: {
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(options.jobTitle ? { jobTitleEn: options.jobTitle } : {}),
      ...(options.department ? { department: options.department } : {}),
      ...(options.projectId
        ? { projects: { some: { projectId: options.projectId, releasedOn: null } } }
        : {}),
      ...(options.search
        ? {
            OR: [
              { nameEn: { contains: options.search, mode: 'insensitive' } },
              { nameAr: { contains: options.search } },
              { code: { contains: options.search, mode: 'insensitive' } },
              { email: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true, code: true, nameEn: true, nameAr: true,
      jobTitleEn: true, department: true, phone: true, email: true,
      hiredOn: true, dailyRate: true, isActive: true,
      user: { select: { id: true, email: true } },
      projects: {
        where: { releasedOn: null },
        select: { roleOnSite: true, project: { select: { id: true, code: true, nameEn: true } } },
      },
      _count: { select: { attendance: true } },
    },
    orderBy: { nameEn: 'asc' },
  });
}

/** Distinct values to populate the employee filter selects — both
 *  job title and department are free text, not lookup tables, so the
 *  option list can only come from what is actually in use. */
export async function employeeFilterOptions() {
  const [jobTitles, departments, projects] = await Promise.all([
    db.employee.findMany({
      where: { deletedAt: null },
      distinct: ['jobTitleEn'],
      select: { jobTitleEn: true },
      orderBy: { jobTitleEn: 'asc' },
    }),
    db.employee.findMany({
      where: { deletedAt: null, department: { not: null } },
      distinct: ['department'],
      select: { department: true },
      orderBy: { department: 'asc' },
    }),
    db.project.findMany({
      where: { deletedAt: null, status: { in: ['PLANNING', 'ACTIVE'] } },
      select: { id: true, code: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    }),
  ]);

  return {
    jobTitles: jobTitles.map((j) => j.jobTitleEn),
    departments: departments.map((d) => d.department!),
    projects,
  };
}

export async function employeeDetail(employeeId: string) {
  return db.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
  });
}

export interface EmployeeInput {
  /** Omitted on create — the server assigns the next EMP-0001-style code. */
  code?: string;
  nameEn: string;
  nameAr?: string | null;
  nationalId?: string | null;
  insuranceNo?: string | null;
  jobTitleEn: string;
  jobTitleAr?: string | null;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  hiredOn: Date;
  dailyRate?: number | string | null;
}

export async function createEmployee(params: { actor: ActorRef; input: EmployeeInput }) {
  const { input, actor } = params;

  if (input.nationalId) {
    const clash = await db.employee.findFirst({
      where: { deletedAt: null, nationalId: input.nationalId },
      select: { id: true },
    });
    if (clash) {
      throw new PeopleError('DUPLICATE', `Another employee is already registered with national ID ${input.nationalId}.`);
    }
  }

  const employee = await transaction(async (tx) => {
    const code = input.code ?? (await nextCode(tx, 'employee'));
    return tx.employee.create({
      data: {
        code,
        nameEn: input.nameEn,
        nameAr: input.nameAr ?? null,
        nationalId: input.nationalId ?? null,
        insuranceNo: input.insuranceNo ?? null,
        jobTitleEn: input.jobTitleEn,
        jobTitleAr: input.jobTitleAr ?? null,
        department: input.department ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        hiredOn: input.hiredOn,
        dailyRate: input.dailyRate != null ? new Prisma.Decimal(input.dailyRate) : null,
      },
    });
  });

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'CREATE',
    entityType: 'Employee',
    entityId: employee.id,
    summary: `Created employee ${employee.code} — ${employee.nameEn}`,
    afterState: { code: employee.code, nameEn: employee.nameEn },
  });

  return employee;
}

export async function updateEmployee(params: {
  actor: ActorRef;
  employeeId: string;
  input: Partial<EmployeeInput>;
}) {
  const before = await db.employee.findFirst({
    where: { id: params.employeeId, deletedAt: null },
  });
  if (!before) throw new PeopleError('NOT_FOUND', 'That employee does not exist.');

  if (
    params.input.nationalId &&
    params.input.nationalId !== before.nationalId
  ) {
    const clash = await db.employee.findFirst({
      where: { deletedAt: null, nationalId: params.input.nationalId, id: { not: params.employeeId } },
      select: { id: true },
    });
    if (clash) {
      throw new PeopleError('DUPLICATE', `Another employee is already registered with national ID ${params.input.nationalId}.`);
    }
  }

  if (params.input.code && params.input.code !== before.code) {
    const clash = await db.employee.findFirst({
      where: { deletedAt: null, code: params.input.code, id: { not: params.employeeId } },
      select: { id: true },
    });
    if (clash) throw new PeopleError('DUPLICATE', `Employee code ${params.input.code} is already in use.`);
  }

  const after = await db.employee.update({
    where: { id: params.employeeId },
    data: {
      ...(params.input.code !== undefined ? { code: params.input.code } : {}),
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(params.input.nationalId !== undefined ? { nationalId: params.input.nationalId } : {}),
      ...(params.input.insuranceNo !== undefined ? { insuranceNo: params.input.insuranceNo } : {}),
      ...(params.input.jobTitleEn !== undefined ? { jobTitleEn: params.input.jobTitleEn } : {}),
      ...(params.input.jobTitleAr !== undefined ? { jobTitleAr: params.input.jobTitleAr } : {}),
      ...(params.input.department !== undefined ? { department: params.input.department } : {}),
      ...(params.input.phone !== undefined ? { phone: params.input.phone } : {}),
      ...(params.input.email !== undefined ? { email: params.input.email } : {}),
      ...(params.input.hiredOn !== undefined ? { hiredOn: params.input.hiredOn } : {}),
      ...(params.input.dailyRate !== undefined
        ? { dailyRate: params.input.dailyRate != null ? new Prisma.Decimal(params.input.dailyRate) : null }
        : {}),
    },
  });

  await writeUpdateAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    entityType: 'Employee',
    entityId: after.id,
    summary: `Updated employee ${after.code}`,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after;
}

export async function archiveEmployee(params: { actor: ActorRef; employeeId: string }) {
  const employee = await db.employee.findFirst({
    where: { id: params.employeeId, deletedAt: null },
    select: {
      id: true, code: true, nameEn: true,
      projects: {
        where: { releasedOn: null },
        select: { project: { select: { code: true } } },
      },
    },
  });
  if (!employee) throw new PeopleError('NOT_FOUND', 'That employee does not exist.');

  if (employee.projects.length > 0) {
    throw new PeopleError(
      'HAS_LIVE_ASSIGNMENTS',
      `${employee.nameEn} is still assigned to ${employee.projects.length} active project${employee.projects.length === 1 ? '' : 's'}. Release them first.`,
    );
  }

  const archived = await db.employee.update({
    where: { id: params.employeeId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'DELETE',
    entityType: 'Employee',
    entityId: archived.id,
    summary: `Archived employee ${archived.code} — ${archived.nameEn}`,
  });

  return archived;
}
