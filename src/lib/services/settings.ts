import 'server-only';

import { cache } from 'react';

import { db, type DbClient } from '../db';
import { writeAudit } from './audit';

/**
 * GTS — organisation settings.
 *
 * Administrator-controlled values that business logic reads: the geofence
 * default, working hours, the late threshold, the company's own tax
 * identity. They live in the database rather than in environment
 * variables because they are business decisions an administrator changes
 * from a screen, not deployment configuration.
 *
 * Reads are request-cached: attendance touches three settings per
 * check-in, and that should be one round trip, not three.
 */

/** Defaults used when a key has never been set. */
export const SETTING_DEFAULTS = {
  'org.nameEn': 'GTS Trading & Contracting',
  'org.nameAr': 'جي تي إس للتجارة والمقاولات',
  'org.trn': '',
  'org.commercialRegNo': '',
  'org.addressLine': '',
  'org.governorateCode': 21,
  'attendance.workStart': '08:00',
  'attendance.workEnd': '17:00',
  'attendance.lateThresholdMinutes': 15,
  'attendance.defaultRadiusMetres': 200,
  'attendance.maxAccuracyMetres': 200,
  'bills.defaultPaymentTermsDays': 30,
  'bills.defaultVatRate': 14,
  'eta.configured': false,
  'locale.default': 'en',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** Every setting, as one map. Cached per request. */
export const allSettings = cache(async (): Promise<Record<string, unknown>> => {
  const rows = await db.setting.findMany();
  const map: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
});

/**
 * Read one setting, falling back to its default.
 *
 * The fallback is typed from the caller's own default, so a caller that
 * asks for a number receives a number even if the stored JSON is wrong.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const settings = await allSettings();
  const value = settings[key];
  if (value === undefined || value === null) return fallback;

  // A setting stored with the wrong JSON type would otherwise propagate a
  // string into arithmetic. Coerce to the shape the caller expects.
  if (typeof fallback === 'number') {
    const n = Number(value);
    return (Number.isFinite(n) ? n : fallback) as T;
  }
  if (typeof fallback === 'boolean') return Boolean(value) as T;
  if (typeof fallback === 'string') return String(value) as T;
  return value as T;
}

export async function setSetting(params: {
  actor: { id: string; email: string };
  key: string;
  value: unknown;
  client?: DbClient;
}): Promise<void> {
  const client = params.client ?? db;

  const existing = await client.setting.findUnique({ where: { key: params.key } });

  await client.setting.upsert({
    where: { key: params.key },
    create: { key: params.key, value: params.value as never },
    update: { value: params.value as never },
  });

  await writeAudit(
    {
      actorId: params.actor.id,
      actorEmail: params.actor.email,
      action: 'UPDATE',
      entityType: 'Setting',
      entityId: params.key,
      summary: `Changed setting ${params.key}`,
      beforeState: existing ? { value: existing.value } : null,
      afterState: { value: params.value },
    },
    client,
  );
}

/** The organisation's own party details, for the top of a tax invoice. */
export async function organisation() {
  const s = await allSettings();
  return {
    nameEn: String(s['org.nameEn'] ?? SETTING_DEFAULTS['org.nameEn']),
    nameAr: String(s['org.nameAr'] ?? SETTING_DEFAULTS['org.nameAr']),
    trn: String(s['org.trn'] ?? ''),
    commercialRegNo: String(s['org.commercialRegNo'] ?? ''),
    addressLine: String(s['org.addressLine'] ?? ''),
    governorateCode: Number(s['org.governorateCode'] ?? 21),
  };
}
