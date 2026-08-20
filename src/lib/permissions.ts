/**
 * GTS — the permission catalogue.
 *
 * This is the authorization vocabulary. Every protected server operation
 * names one of these keys, and the check happens on the server before the
 * work runs. Hiding a button is a courtesy to the user; it is not a
 * security control, and nothing here assumes the client cooperated.
 *
 * Keys are `module.action` and are stable — they are stored in the
 * database on role_permissions rows, so renaming one is a migration.
 */

export const PERMISSIONS = [
  /* ---- Clients ---- */
  { key: 'clients.view', module: 'clients', action: 'view', description: 'View clients and their history' },
  { key: 'clients.create', module: 'clients', action: 'create', description: 'Create clients' },
  { key: 'clients.edit', module: 'clients', action: 'edit', description: 'Edit client records' },
  { key: 'clients.delete', module: 'clients', action: 'delete', description: 'Archive clients' },

  /* ---- Vendors ---- */
  { key: 'vendors.view', module: 'vendors', action: 'view', description: 'View vendors and their history' },
  { key: 'vendors.create', module: 'vendors', action: 'create', description: 'Create vendors' },
  { key: 'vendors.edit', module: 'vendors', action: 'edit', description: 'Edit vendor records' },
  { key: 'vendors.delete', module: 'vendors', action: 'delete', description: 'Archive vendors' },

  /* ---- Projects ---- */
  { key: 'projects.view', module: 'projects', action: 'view', description: 'View projects' },
  { key: 'projects.create', module: 'projects', action: 'create', description: 'Create projects' },
  { key: 'projects.edit', module: 'projects', action: 'edit', description: 'Edit projects' },
  { key: 'projects.delete', module: 'projects', action: 'delete', description: 'Archive projects' },
  {
    key: 'projects.location',
    module: 'projects',
    action: 'location',
    description: 'Set the official site location and geofence radius',
  },
  { key: 'projects.assign', module: 'projects', action: 'assign', description: 'Assign employees to projects' },

  /* ---- Products & inventory ---- */
  { key: 'products.view', module: 'products', action: 'view', description: 'View the product catalogue' },
  { key: 'products.create', module: 'products', action: 'create', description: 'Create products' },
  { key: 'products.edit', module: 'products', action: 'edit', description: 'Edit products' },
  { key: 'products.delete', module: 'products', action: 'delete', description: 'Archive products' },

  { key: 'inventory.view', module: 'inventory', action: 'view', description: 'View stock levels and movements' },
  {
    key: 'inventory.manage',
    module: 'inventory',
    action: 'manage',
    description: 'Receive, issue, transfer, return and adjust stock',
  },
  {
    key: 'inventory.adjust',
    module: 'inventory',
    action: 'adjust',
    description: 'Post stock adjustments that correct a count',
  },

  { key: 'warehouses.view', module: 'warehouses', action: 'view', description: 'View warehouses' },
  { key: 'warehouses.manage', module: 'warehouses', action: 'manage', description: 'Create and edit warehouses' },

  /* ---- Billing ---- */
  { key: 'bills.view', module: 'bills', action: 'view', description: 'View electronic bills' },
  { key: 'bills.create', module: 'bills', action: 'create', description: 'Draft electronic bills' },
  { key: 'bills.edit', module: 'bills', action: 'edit', description: 'Edit draft bills' },
  {
    key: 'bills.approve',
    module: 'bills',
    action: 'approve',
    description: 'Approve or reject bills awaiting approval',
  },
  { key: 'bills.cancel', module: 'bills', action: 'cancel', description: 'Cancel issued bills' },
  { key: 'bills.send', module: 'bills', action: 'send', description: 'Mark an approved bill as sent' },

  { key: 'payments.view', module: 'payments', action: 'view', description: 'View payments' },
  { key: 'payments.record', module: 'payments', action: 'record', description: 'Record payments received or made' },

  { key: 'accounts.view', module: 'accounts', action: 'view', description: 'View account summaries and ageing' },

  /* ---- Attendance ---- */
  {
    key: 'attendance.check_in',
    module: 'attendance',
    action: 'check_in',
    description: 'Check in and out of an assigned project site',
  },
  {
    key: 'attendance.view',
    module: 'attendance',
    action: 'view',
    description: "View other people's attendance records",
  },
  {
    key: 'attendance.manage',
    module: 'attendance',
    action: 'manage',
    description: 'Correct attendance records and configure working hours',
  },

  /* ---- Leave ---- */
  { key: 'leave.request', module: 'leave', action: 'request', description: 'Request leave for yourself' },
  { key: 'leave.view', module: 'leave', action: 'view', description: "View other people's leave" },
  { key: 'leave.approve', module: 'leave', action: 'approve', description: 'Approve or reject leave requests' },
  { key: 'leave.manage', module: 'leave', action: 'manage', description: 'Configure leave types and balances' },

  /* ---- People ---- */
  { key: 'employees.view', module: 'employees', action: 'view', description: 'View the employee directory' },
  { key: 'employees.manage', module: 'employees', action: 'manage', description: 'Create and edit employees' },

  /* ---- System ---- */
  { key: 'users.view', module: 'users', action: 'view', description: 'View user accounts' },
  { key: 'users.manage', module: 'users', action: 'manage', description: 'Create, edit and deactivate users' },
  { key: 'roles.manage', module: 'roles', action: 'manage', description: 'Create roles and assign permissions' },
  { key: 'reports.view', module: 'reports', action: 'view', description: 'View and export reports' },
  { key: 'audit.view', module: 'audit', action: 'view', description: 'Read the audit log' },
  { key: 'settings.manage', module: 'settings', action: 'manage', description: 'Change organisation settings' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

/** Grouped for the permission matrix screen. */
export const PERMISSIONS_BY_MODULE = PERMISSIONS.reduce<
  Record<string, (typeof PERMISSIONS)[number][]>
>((acc, p) => {
  (acc[p.module] ??= []).push(p);
  return acc;
}, {});

/* ============================================================
   ROLES
   ============================================================ */

/**
 * The administrator role key. Holding it grants every permission
 * implicitly — `can()` short-circuits on it — so a permission added in a
 * later release does not silently lock the administrator out of a screen
 * that did not exist when their role was configured.
 */
export const ADMIN_ROLE = 'admin';

/**
 * Seed roles.
 *
 * These reflect how an Egyptian trading and contracting company actually
 * divides the work: the financial controller does not move stock, the
 * storekeeper does not approve invoices, and the site foreman can see
 * only the site.
 */
export const SEED_ROLES: {
  key: string;
  nameEn: string;
  nameAr: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionKey[] | 'ALL';
}[] = [
  {
    key: ADMIN_ROLE,
    nameEn: 'Administrator',
    nameAr: 'مدير النظام',
    description: 'Full access to every module and setting.',
    isSystem: true,
    permissions: 'ALL',
  },
  {
    key: 'finance',
    nameEn: 'Financial controller',
    nameAr: 'المدير المالي',
    description: 'Bills, payments, account summaries and financial reports.',
    isSystem: false,
    permissions: [
      'clients.view', 'clients.create', 'clients.edit',
      'vendors.view', 'vendors.create', 'vendors.edit',
      'projects.view',
      'products.view', 'inventory.view',
      'bills.view', 'bills.create', 'bills.edit', 'bills.approve', 'bills.cancel', 'bills.send',
      'payments.view', 'payments.record',
      'accounts.view', 'reports.view',
      'attendance.view', 'leave.request', 'leave.view',
      'employees.view',
    ],
  },
  {
    key: 'operations',
    nameEn: 'Operations manager',
    nameAr: 'مدير العمليات',
    description: 'Projects, site locations, assignments, attendance and leave approval.',
    isSystem: false,
    permissions: [
      'clients.view',
      'vendors.view',
      'projects.view', 'projects.create', 'projects.edit', 'projects.location', 'projects.assign',
      'products.view',
      'inventory.view', 'inventory.manage',
      'warehouses.view',
      'bills.view',
      'accounts.view', 'reports.view',
      'attendance.check_in', 'attendance.view', 'attendance.manage',
      'leave.request', 'leave.view', 'leave.approve',
      'employees.view', 'employees.manage',
    ],
  },
  {
    key: 'storekeeper',
    nameEn: 'Storekeeper',
    nameAr: 'أمين المخزن',
    description: 'Receives, issues and transfers stock. Cannot price or approve anything.',
    isSystem: false,
    permissions: [
      'projects.view',
      'products.view',
      'inventory.view', 'inventory.manage',
      'warehouses.view',
      'attendance.check_in',
      'leave.request',
      'reports.view',
    ],
  },
  {
    key: 'employee',
    nameEn: 'Employee',
    nameAr: 'موظف',
    description: 'Checks in at an assigned site and requests leave. Sees nothing financial.',
    isSystem: false,
    permissions: ['attendance.check_in', 'leave.request', 'projects.view'],
  },
];

/**
 * Does this permission set allow the action?
 *
 * The administrator short-circuit is the important line: role `admin`
 * passes every check without needing a row per permission, so the system
 * cannot be locked out by an incomplete role_permissions table.
 */
export function can(
  actor: { roleKey: string; permissions: readonly string[] },
  permission: PermissionKey,
): boolean {
  if (actor.roleKey === ADMIN_ROLE) return true;
  return actor.permissions.includes(permission);
}

/** True when the actor holds every one of the listed permissions. */
export function canAll(
  actor: { roleKey: string; permissions: readonly string[] },
  permissions: PermissionKey[],
): boolean {
  if (actor.roleKey === ADMIN_ROLE) return true;
  return permissions.every((p) => actor.permissions.includes(p));
}

/** True when the actor holds at least one of the listed permissions. */
export function canAny(
  actor: { roleKey: string; permissions: readonly string[] },
  permissions: PermissionKey[],
): boolean {
  if (actor.roleKey === ADMIN_ROLE) return true;
  return permissions.some((p) => actor.permissions.includes(p));
}
