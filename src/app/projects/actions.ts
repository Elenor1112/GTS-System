'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, dateOnly, optionalText, requiredText, id, checkbox } from '@/lib/action';
import { can } from '@/lib/permissions';
import { ForbiddenError } from '@/lib/auth';
import {
  createProject, updateProject, setProjectLocation,
  assignEmployee, releaseEmployee, archiveProject,
} from '@/lib/services/projects';
import {
  allocateToProject, deliverToProject, returnFromProject,
} from '@/lib/services/inventory';
import { GOVERNORATE_CODES } from '@/lib/egypt';

/** Project mutations. Location and assignment carry their own permissions. */

const optionalDate = z
  .preprocess(
    (v) => (v === '' || v === undefined || v === null ? null : v),
    z.union([dateOnly, z.null()]),
  );

const projectSchema = z.object({
  nameEn: requiredText('Name', 200),
  nameAr: optionalText,
  clientId: id,
  status: z
    .enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .optional(),
  startsOn: optionalDate,
  endsOn: optionalDate,
  budget: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? null : v),
    z.union([z.coerce.number().nonnegative('A budget cannot be negative'), z.null()]),
  ),
  notes: optionalText,
});

/* ============================================================
   CREATE — with optional day-one location, team member, material

   The create form may carry three optional bundles alongside the base
   project fields, posted with dotted names (`location.addressLine`,
   `material.productId`, …) because that reads better in the form than
   an invented flat-name scheme. `unflattenGroups` below turns those
   into nested objects before Zod sees them.

   Each bundle still runs through its OWN permission check inside the
   handler, not just `projects.create` — the page only renders a bundle's
   fields to someone who already holds that permission, but the action
   must not trust the client for that; a request forged with those keys
   must fail exactly as it would from the dedicated form.
   ============================================================ */

function unflattenGroups(raw: Record<string, unknown>, prefixes: string[]) {
  const out: Record<string, unknown> = { ...raw };
  for (const prefix of prefixes) {
    const group: Record<string, unknown> = {};
    let found = false;
    for (const key of Object.keys(raw)) {
      if (!key.startsWith(`${prefix}.`)) continue;
      group[key.slice(prefix.length + 1)] = raw[key];
      delete out[key];
      found = true;
    }
    if (found) out[prefix] = group;
  }
  return out;
}

const optionalLocationSchema = z
  .object({
    addressLine: requiredText('Address', 300),
    governorateCode: z.coerce
      .number()
      .refine((v) => GOVERNORATE_CODES.has(v), 'Choose one of the 27 governorates'),
    latitude: z.coerce
      .number()
      .refine(Number.isFinite, 'Enter a latitude')
      .refine((v) => v >= -90 && v <= 90, 'Latitude must be between −90 and 90'),
    longitude: z.coerce
      .number()
      .refine(Number.isFinite, 'Enter a longitude')
      .refine((v) => v >= -180 && v <= 180, 'Longitude must be between −180 and 180'),
    radiusMetres: z.coerce
      .number()
      .int('The radius must be a whole number of metres')
      .refine((v) => v >= 25 && v <= 5000, 'The radius must be between 25m and 5km'),
    siteType: z.enum(['office', 'warehouse', 'site', 'yard']).optional(),
  })
  .optional();

const optionalMaterialSchema = z
  .object({
    productId: id,
    warehouseId: id,
    quantity: z.coerce
      .number({ message: 'Enter a quantity' })
      .refine(Number.isFinite, 'Enter a quantity')
      .positive('The quantity must be greater than zero'),
    agreedPrice: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : v),
      z.union([z.coerce.number().nonnegative('A price cannot be negative'), z.null()]),
    ),
  })
  .optional();

// A checkbox list posts one value per box checked: none, one bare
// string, or several — `formToObject` only produces an array once
// there are two or more, so a single checked box needs folding back
// into a one-element array here.
const idList = z.preprocess(
  (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
  z.array(id),
);

const createProjectSchema = projectSchema.extend({
  location: optionalLocationSchema,
  assignEmployeeIds: idList,
  roleOnSite: optionalText,
  material: optionalMaterialSchema,
});

const createProjectAction = action({
  permission: 'projects.create',
  input: createProjectSchema,
  handler: async ({ location, assignEmployeeIds, roleOnSite, material, ...input }, { actor }) => {
    const project = await createProject({ actor, input });

    // Only a filled-in address means the section was actually opened —
    // an empty object never reaches here because `location` is omitted
    // from the posted form entirely when the checkbox is off.
    if (location) {
      if (!can(actor, 'projects.location')) throw new ForbiddenError('projects.location');
      await setProjectLocation({ actor, projectId: project.id, input: location });
    }

    if (assignEmployeeIds.length > 0) {
      if (!can(actor, 'projects.assign')) throw new ForbiddenError('projects.assign');
      // Sequential, not Promise.all: each call re-reads the project's
      // open/closed status and re-checks for a duplicate assignment,
      // and concurrent writes to the same project row would race that.
      for (const employeeId of assignEmployeeIds) {
        await assignEmployee({ actor, projectId: project.id, employeeId, roleOnSite });
      }
    }

    if (material) {
      if (!can(actor, 'inventory.manage')) throw new ForbiddenError('inventory.manage');
      await allocateToProject({ actor, projectId: project.id, ...material });
    }

    revalidatePath('/projects');
    return { id: project.id, code: project.code };
  },
});

const updateProjectAction = action({
  permission: 'projects.edit',
  input: projectSchema.partial().extend({ projectId: id, code: requiredText('Project code', 32) }),
  handler: async ({ projectId, ...input }, { actor }) => {
    const project = await updateProject({ actor, projectId, input });
    revalidatePath('/projects');
    revalidatePath(`/projects/${projectId}`);
    return { id: project.id };
  },
});

/* ============================================================
   THE SITE LOCATION

   Its own permission. Moving a boundary changes who may record
   attendance and from where, which is a security act rather than a
   detail of editing a project.
   ============================================================ */

const locationSchema = z.object({
  projectId: id,
  addressLine: requiredText('Address', 300),
  governorateCode: z.coerce
    .number()
    .refine((v) => GOVERNORATE_CODES.has(v), 'Choose one of the 27 governorates'),
  latitude: z.coerce
    .number()
    .refine(Number.isFinite, 'Enter a latitude')
    .refine((v) => v >= -90 && v <= 90, 'Latitude must be between −90 and 90'),
  longitude: z.coerce
    .number()
    .refine(Number.isFinite, 'Enter a longitude')
    .refine((v) => v >= -180 && v <= 180, 'Longitude must be between −180 and 180'),
  radiusMetres: z.coerce
    .number()
    .int('The radius must be a whole number of metres')
    .refine(
      (v) => v >= 25 && v <= 5000,
      'The radius must be between 25m and 5km — below 25m ordinary GPS drift locks people out',
    ),
  siteType: z.enum(['office', 'warehouse', 'site', 'yard']).optional(),
});

const setProjectLocationAction = action({
  permission: 'projects.location',
  input: locationSchema,
  handler: async ({ projectId, ...input }, { actor }) => {
    await setProjectLocation({ actor, projectId, input });
    revalidatePath('/projects');
    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/attendance');
    return { saved: true as const };
  },
});

/* ============================================================
   ASSIGNMENTS
   ============================================================ */

const assignEmployeeAction = action({
  permission: 'projects.assign',
  input: z.object({
    projectId: id,
    employeeId: id,
    roleOnSite: optionalText,
  }),
  handler: async (input, { actor }) => {
    const result = await assignEmployee({ actor, ...input });
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath('/attendance');
    return {
      id: result.assignment.id,
      // Surfaced so the screen can warn: an assignment to a project with
      // no coordinates cannot produce attendance.
      hasLocation: result.hasLocation,
    };
  },
});

const releaseEmployeeAction = action({
  permission: 'projects.assign',
  input: z.object({ assignmentId: id, projectId: id }),
  handler: async ({ assignmentId, projectId }, { actor }) => {
    await releaseEmployee({ actor, assignmentId });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/attendance');
    return { released: true as const };
  },
});

const archiveProjectAction = action({
  permission: 'projects.delete',
  input: z.object({ projectId: id }),
  handler: async ({ projectId }, { actor }) => {
    await archiveProject({ actor, projectId });
    revalidatePath('/projects');
    return { archived: true as const };
  },
});

/* ============================================================
   MATERIALS

   Stock on a site moves in three steps, and each is a separate act with
   its own arithmetic: allocation takes units out of a warehouse,
   delivery hands them to the client, and a return puts them back on a
   shelf — or writes them off as damaged.

   They carry `inventory.manage` rather than a projects permission. The
   stock is the warehouse's until it is delivered, so the person allowed
   to move it is the storekeeper, not whoever may edit the project's
   name.
   ============================================================ */

/** A quantity in units. Three decimals, matching the Decimal(14,3)
 *  columns — aggregate and cable are issued in fractions. */
const quantity = z.coerce
  .number({ message: 'Enter a quantity' })
  .refine(Number.isFinite, 'Enter a quantity')
  .positive('The quantity must be greater than zero');

const allocateAction = action({
  permission: 'inventory.manage',
  input: z.object({
    projectId: id,
    productId: id,
    warehouseId: id,
    quantity,
    agreedPrice: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : v),
      z.union([z.coerce.number().nonnegative('A price cannot be negative'), z.null()]),
    ),
    notes: optionalText,
  }),
  handler: async ({ projectId, ...input }, { actor }) => {
    const result = await allocateToProject({ actor, projectId, ...input });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/products/${input.productId}`);
    revalidatePath(`/storage/${input.warehouseId}`);
    revalidatePath('/storage');
    return { allocated: result.position.allocated.toString() };
  },
});

const deliverAction = action({
  permission: 'inventory.manage',
  input: z.object({
    projectId: id,
    productId: id,
    quantity,
    reference: optionalText,
  }),
  handler: async ({ projectId, ...input }, { actor }) => {
    const result = await deliverToProject({ actor, projectId, ...input });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/products/${input.productId}`);
    return { delivered: result.delivered.toString() };
  },
});

const returnAction = action({
  permission: 'inventory.manage',
  input: z.object({
    projectId: id,
    productId: id,
    warehouseId: id,
    quantity,
    // A checkbox: ticked means the units are written off rather than
    // restocked, which is a different ledger row entirely.
    damaged: checkbox,
    reason: optionalText,
  }),
  handler: async ({ projectId, ...input }, { actor }) => {
    const result = await returnFromProject({ actor, projectId, ...input });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/products/${input.productId}`);
    revalidatePath(`/storage/${input.warehouseId}`);
    revalidatePath('/storage');
    // `returnFromProject` returns { position, movement } — the running
    // totals live on the position, not on the result itself.
    return {
      returned: result.position.returned.toString(),
      damaged: result.position.damaged.toString(),
      remaining: result.position.delivered
        .minus(result.position.returned)
        .minus(result.position.damaged)
        .toString(),
    };
  },
});

/* ---- Form adapters ---- */

export async function submitCreateProject(_previous: unknown, formData: FormData) {
  return createProjectAction(unflattenGroups(formToObject(formData), ['location', 'material']));
}

export async function submitUpdateProject(_previous: unknown, formData: FormData) {
  return updateProjectAction(formToObject(formData));
}

export async function submitProjectLocation(_previous: unknown, formData: FormData) {
  return setProjectLocationAction(formToObject(formData));
}

export async function submitAssignEmployee(_previous: unknown, formData: FormData) {
  return assignEmployeeAction(formToObject(formData));
}

export async function submitReleaseEmployee(_previous: unknown, formData: FormData) {
  return releaseEmployeeAction(formToObject(formData));
}


/** Callable form of `archiveProjectAction`, exported because a 'use server' module
 *  may export only async functions. */
export async function submitArchiveProject(input: unknown) {
  return archiveProjectAction(input);
}

export async function submitAllocateToProject(_previous: unknown, formData: FormData) {
  return allocateAction(formToObject(formData));
}

export async function submitDeliverToProject(_previous: unknown, formData: FormData) {
  return deliverAction(formToObject(formData));
}

export async function submitReturnFromProject(_previous: unknown, formData: FormData) {
  return returnAction(formToObject(formData));
}
