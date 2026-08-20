'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  verifyPassword,
  hashPassword,
  createSession,
  destroySession,
  destroyAllSessions,
  requireActor,
  requestMeta,
  sweepExpiredSessions,
} from '@/lib/auth';
import { writeAudit } from '@/lib/services/audit';
import { fail, ok, toResult, type ActionResult } from '@/lib/action';

/**
 * GTS — authentication actions.
 *
 * These deliberately do not use the `action()` wrapper: signing in is the
 * one mutation that cannot require an existing session.
 */

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

/**
 * A deliberate delay floor on failed sign-in.
 *
 * Argon2 verification takes ~50ms; a lookup that finds no user returns in
 * ~5ms. That difference tells an attacker which addresses are registered.
 * Every failure path is padded to the same floor.
 */
const MIN_FAILURE_MS = 350;

/** Simple in-process attempt tracking. */
const attempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

function rateLimit(key: string): { allowed: boolean; retryInMinutes?: number } {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) return { allowed: true };
  if (record.lockedUntil > now) {
    return { allowed: false, retryInMinutes: Math.ceil((record.lockedUntil - now) / 60_000) };
  }
  if (now - record.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailure(key: string): void {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }

  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }
}

function clearFailures(key: string): void {
  attempts.delete(key);
}

/** Only ever redirect within this application. A crafted `from=` must not
 *  bounce somebody to another site carrying the trust of having just
 *  signed in here. Protocol-relative `//evil.com` is a URL to the browser
 *  but starts with `/`, so it is rejected explicitly. */
function safeReturnTo(target: FormDataEntryValue | null): string {
  if (typeof target !== 'string') return '/dashboard';
  if (!target.startsWith('/') || target.startsWith('//')) return '/dashboard';
  return target;
}

export async function signIn(
  _previous: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const startedAt = Date.now();
  const returnTo = safeReturnTo(formData.get('returnTo'));
  let succeeded = false;

  /** Pad every failure to the same duration, whatever went wrong. */
  const failSlowly = async (result: ActionResult<never>) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_FAILURE_MS) {
      await new Promise((r) => setTimeout(r, MIN_FAILURE_MS - elapsed));
    }
    return result;
  };

  try {
    const parsed = signInSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    if (!parsed.success) {
      return failSlowly(
        fail('VALIDATION', 'Enter your email address and password.', {
          fieldErrors: parsed.error.issues.reduce<Record<string, string[]>>((acc, issue) => {
            const key = issue.path.join('.') || '_form';
            (acc[key] ??= []).push(issue.message);
            return acc;
          }, {}),
        }),
      );
    }

    const { email, password } = parsed.data;
    const meta = await requestMeta();

    /*
     * Keyed on the ACCOUNT plus the origin, not the origin alone.
     *
     * An office shares one public IP, so an IP-only bucket lets one
     * person fat-fingering their password lock out the whole floor —
     * a denial of service delivered by a colleague. Including the email
     * confines the lockout to the account actually under attack, which
     * is what the control is for.
     */
    const limitKey = `${email}|${meta.ipAddress ?? 'unknown'}`;

    const limit = rateLimit(limitKey);
    if (!limit.allowed) {
      return failSlowly(
        fail(
          'RATE_LIMITED',
          `Too many failed attempts. Try again in ${limit.retryInMinutes} minutes.`,
        ),
      );
    }

    const user = await db.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true, passwordHash: true, isActive: true },
    });

    // Same message whether the address is unknown or the password wrong:
    // "no such account" tells an attacker which addresses to keep trying.
    const invalid = fail('INVALID_CREDENTIALS', 'That email address and password do not match.');

    if (!user) {
      recordFailure(limitKey);
      await writeAudit({
        actorEmail: email,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        summary: 'Sign-in attempt for an unknown address',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return failSlowly(invalid);
    }

    const correct = await verifyPassword(user.passwordHash, password);
    if (!correct) {
      recordFailure(limitKey);
      await writeAudit({
        actorId: user.id,
        actorEmail: email,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        summary: 'Wrong password',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return failSlowly(invalid);
    }

    // A deactivated account is told so only AFTER the password checked
    // out — otherwise the message becomes an account-existence oracle.
    if (!user.isActive) {
      return failSlowly(
        fail('ACCOUNT_DISABLED', 'This account has been deactivated. Contact your administrator.'),
      );
    }

    clearFailures(limitKey);

    /*
     * Sweep expired sessions BEFORE the new one is created, and await it.
     *
     * `getActor()` treats an expired row as absent but does not delete
     * it — turning every page render into a write would be worse. So
     * they are cleared here instead: sign-in is frequent enough to keep
     * the table small, rare enough that one extra DELETE is invisible,
     * and already a write.
     *
     * It must be awaited. Left as `void sweep()`, the DELETE escapes the
     * request and runs against a connection whose lifetime is the
     * response's, racing the very session row this sign-in is about to
     * write. Ordering it first also means the sweep can never observe
     * the new row at all. Failures are still swallowed: housekeeping
     * must not be the reason somebody cannot sign in.
     */
    await sweepExpiredSessions().catch((error) => {
      console.warn('[auth] session sweep failed:', error);
    });

    await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      summary: 'Signed in',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    succeeded = true;
  } catch (error) {
    return failSlowly(toResult(error));
  }

  /*
   * Redirect from the SERVER, and only outside the try.
   *
   * `redirect()` signals by throwing, so calling it inside the try above
   * would be caught by the very `catch` meant for real failures and
   * turned into an error result.
   *
   * Redirecting here rather than from the client is what makes the
   * session stick: the browser commits this response's `Set-Cookie` and
   * follows the redirect as one step. The previous client-side
   * `router.replace()` raced the cookie write against the next request,
   * so the dashboard could be fetched with no cookie attached and throw
   * UnauthenticatedError despite a session row existing.
   */
  if (succeeded) redirect(returnTo);

  // Unreachable: every path above either returned or set `succeeded`.
  return fail('UNKNOWN', 'Something went wrong. Try again.');
}

export async function signOut(): Promise<void> {
  const actor = await requireActor().catch(() => null);

  if (actor) {
    const meta = await requestMeta();
    await writeAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: actor.id,
      summary: 'Signed out',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  await destroySession();
  redirect('/sign-in');
}

/* ============================================================
   PASSWORD CHANGE
   ============================================================ */

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    // 12 characters with no composition rules: length is what actually
    // resists cracking, and forced symbols push people towards P@ssw0rd1.
    newPassword: z.string().min(12, 'Use at least 12 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'The two passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'The new password must differ from the current one',
    path: ['newPassword'],
  });

export async function changePassword(
  _previous: ActionResult<{ changed: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ changed: true }>> {
  try {
    const actor = await requireActor();

    const parsed = passwordSchema.safeParse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
      return fail('VALIDATION', 'Check the highlighted fields.', {
        fieldErrors: parsed.error.issues.reduce<Record<string, string[]>>((acc, issue) => {
          const key = issue.path.join('.') || '_form';
          (acc[key] ??= []).push(issue.message);
          return acc;
        }, {}),
      });
    }

    const user = await db.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { passwordHash: true },
    });

    const correct = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
    if (!correct) {
      return fail('WRONG_PASSWORD', 'Your current password is not correct.', {
        fieldErrors: { currentPassword: ['That is not your current password'] },
      });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.user.update({ where: { id: actor.id }, data: { passwordHash } });

    const meta = await requestMeta();
    await writeAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: actor.id,
      summary: 'Changed their own password',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Every other device is signed out: a password change is what someone
    // does when they think a session may be compromised.
    await destroyAllSessions(actor.id);
    await createSession(actor.id);

    return ok({ changed: true });
  } catch (error) {
    return toResult(error);
  }
}
