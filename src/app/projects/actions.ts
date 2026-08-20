'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, dateOnly, optionalText, requiredText, id, checkbox } from '@/lib/action';
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
  code: requiredText('Project code', 32),
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

const createProjectAction = action({
  permission: 'projects.create',
  input: projectSchema,
  handler: async (input, { actor }) => {
    const project = await createProject({ actor, input });
    revalidatePath('/projects');
    return { id: project.id, code: project.code };
  },
});

const updateProjectAction = action({
  permission: 'projects.edit',
  input: projectSchema.partial().extend({ projectId: id }),
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
  return createProjectAction(formToObject(formData));
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
