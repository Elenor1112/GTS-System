import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

import { db } from './db';
import { ADMIN_ROLE, can, type PermissionKey } from './permissions';

/**
 * GTS — authentication and the server-side authorization guard.
 *
 * Sessions are opaque tokens stored server-side. The cookie holds a
 * random 256-bit value; the database holds only its SHA-256. That way a
 * database leak does not hand an attacker live sessions, and signing out
 * genuinely ends the session rather than hoping the client discards a JWT.
 */

const SESSION_COOKIE = 'gts_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // A working day plus margin.

/* ============================================================
   PASSWORDS
   ============================================================ */

/**
 * Argon2id parameters.
 *
 * OWASP's 2024 floor is 19 MiB / t=2 / p=1. Memory cost is the parameter
 * that actually resists GPU cracking, so it is raised rather than the
 * iteration count.
 */
const ARGON_OPTS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, ARGON_OPTS);
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  try {
    return await argonVerify(hashValue, plain);
  } catch {
    // A malformed hash in the database must read as "wrong password",
    // never as an exception that reveals the account exists.
    return false;
  }
}

/* ============================================================
   SESSION TOKENS
   ============================================================ */

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison, for anywhere a secret is compared directly. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/* ============================================================
   THE ACTOR
   ============================================================ */

export interface Actor {
  id: string;
  email: string;
  nameEn: string;
  nameAr: string | null;
  roleId: string;
  roleKey: string;
  roleNameEn: string;
  permissions: string[];
  /** Present only when this user is also an employee — attendance and
   *  leave are employee concerns, and an accounts-only login has neither. */
  employeeId: string | null;
  employeeCode: string | null;
  isAdmin: boolean;
}

/**
 * Resolve the current actor from the session cookie.
 *
 * Wrapped in React's `cache` so a page that calls it in the layout, the
 * page and three components still performs exactly one query per request.
 * Returns null rather than throwing, so public routes can call it freely.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  /*
   * A failed lookup is NOT a missing session.
   *
   * If the query itself throws — a pool timeout, a dropped connection —
   * returning null tells every caller "signed out", and the page throws
   * UnauthenticatedError. The user is then bounced to sign-in, where
   * their cookie still works, and the whole thing reads as a
   * mysterious intermittent auth bug rather than as the infrastructure
   * hiccup it is. Letting it propagate means the error boundary reports
   * a real failure instead of a false one.
   */
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          nameEn: true,
          nameAr: true,
          isActive: true,
          deletedAt: true,
          roleId: true,
          role: {
            select: {
              key: true,
              nameEn: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
          employee: { select: { id: true, code: true, deletedAt: true } },
        },
      },
    },
  });

  if (!session) return null;

  // An expired row is treated as absent. Sweeping it is the session
  // cleaner's job, not this request's — deleting here would turn every
  // page render into a write.
  if (session.expiresAt.getTime() < Date.now()) return null;

  const { user } = session;
  // Deactivating or archiving a user must take effect on their next
  // request, not whenever their session happens to expire.
  if (!user.isActive || user.deletedAt) return null;

  const employee = user.employee && !user.employee.deletedAt ? user.employee : null;

  return {
    id: user.id,
    email: user.email,
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    roleId: user.roleId,
    roleKey: user.role.key,
    roleNameEn: user.role.nameEn,
    permissions: user.role.permissions.map((rp) => rp.permission.key),
    employeeId: employee?.id ?? null,
    employeeCode: employee?.code ?? null,
    isAdmin: user.role.key === ADMIN_ROLE,
  };
});

/* ============================================================
   GUARDS

   These are the functions every protected server operation calls.
   They throw rather than returning a flag, so forgetting to check the
   return value cannot leave an action running unauthorised.
   ============================================================ */

/*
 * Stable tags carried on `error.digest`.
 *
 * An `error.tsx` boundary is a CLIENT component, and Next deliberately
 * strips a server error's message and stack before it reaches one — in
 * production all it receives is `digest`. Class names do not survive
 * minification either, so `instanceof` and `error.name` are both useless
 * there. Setting `digest` ourselves is the one channel that does survive,
 * which is what lets the boundary tell "signed out" apart from
 * "not permitted" apart from a genuine bug.
 */
export const AUTH_DIGEST = {
  unauthenticated: 'GTS_UNAUTHENTICATED',
  forbidden: 'GTS_FORBIDDEN',
} as const;

/** Thrown when nobody is signed in. */
export class UnauthenticatedError extends Error {
  readonly digest = AUTH_DIGEST.unauthenticated;
  constructor() {
    super('Sign in to continue.');
    this.name = 'UnauthenticatedError';
  }
}

/** Thrown when the actor is known but not permitted. */
export class ForbiddenError extends Error {
  readonly digest = AUTH_DIGEST.forbidden;
  readonly permission: string;
  constructor(permission: string) {
    super(`You do not have permission to do this (${permission}).`);
    this.name = 'ForbiddenError';
    this.permission = permission;
  }
}

/** The signed-in actor, or throw. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

/**
 * The signed-in actor holding a specific permission, or throw.
 *
 * This is the single line that makes authorization real. It runs on the
 * server, against the database's own record of the role, and it does not
 * consult anything the browser sent.
 */
export async function requirePermission(permission: PermissionKey): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor, permission)) throw new ForbiddenError(permission);
  return actor;
}

/** Non-throwing check, for deciding whether to render a control. */
export async function hasPermission(permission: PermissionKey): Promise<boolean> {
  const actor = await getActor();
  return actor ? can(actor, permission) : false;
}

/* ============================================================
   SIGN IN / OUT
   ============================================================ */

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  const hdrs = await headers();

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ipAddress: clientIp(hdrs),
      userAgent: hdrs.get('user-agent')?.slice(0, 500) ?? null,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, // Unreadable to script: an XSS cannot exfiltrate it.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Blocks cross-site POSTs while keeping normal links working.
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token) {
    // Delete the row first: the session must die even if the cookie
    // somehow survives on the client.
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Sign every device out — used when a password changes. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

/** Remove expired rows. Called opportunistically, not on every request. */
export async function sweepExpiredSessions(): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

/* ============================================================
   REQUEST METADATA — recorded on audit rows
   ============================================================ */

export function clientIp(hdrs: Headers): string | null {
  const forwarded = hdrs.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return hdrs.get('x-real-ip') ?? null;
}

export async function requestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const hdrs = await headers();
  return {
    ipAddress: clientIp(hdrs),
    userAgent: hdrs.get('user-agent')?.slice(0, 500) ?? null,
  };
}

export { SESSION_COOKIE, SESSION_TTL_MS, hashToken };
