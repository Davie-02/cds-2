export const PERMISSIONS = {
  "dashboard.view": "See the dashboard",
  "content.manage": "Edit website pages, menus, news, FAQ, gallery and other content",
  "courses.manage": "Edit courses, packages and prices",
  "instructors.manage": "Edit instructor profiles and availability",
  "vehicles.view": "See vehicles",
  "vehicles.manage": "Edit vehicles, service and insurance dates",
  "bookings.view": "See every lesson booking",
  "bookings.view_own": "See their own lessons (instructors)",
  "bookings.manage": "Create, confirm, cancel and reschedule any booking",
  "students.view": "See every student",
  "students.view_own": "See their own students (instructors)",
  "students.manage": "Register and edit students and their documents",
  "students.notes": "Write lesson notes and update skills checklists",
  "theory.manage": "Edit the question bank and theory tests",
  "theory.results": "See theory test results",
  "tests.manage": "Book official road and theory tests and record results",
  "finance.view": "See invoices, payments and balances",
  "finance.manage": "Create invoices and record or confirm payments",
  "enquiries.manage": "Handle website enquiries",
  "settings.manage": "Change business settings and booking rules",
  "activity.view": "See the activity log",
  "activity.undo": "Undo changes from the activity log",
  "recycle.restore": "Restore deleted items",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const STAFF_ROLES = ["owner", "office", "instructor", "accountant"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type Role = StaffRole | "student";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  office: ALL_PERMISSIONS.filter((permission) => permission !== "settings.manage"),
  instructor: [
    "dashboard.view",
    "bookings.view_own",
    "students.view_own",
    "students.notes",
    "vehicles.view",
    "theory.results",
  ],
  accountant: [
    "dashboard.view",
    "finance.view",
    "finance.manage",
    "students.view",
    "activity.view",
  ],
  student: [],
};

export type PermissionOverrides = Partial<Record<Permission, boolean>>;

/**
 * Effective permissions are the role's defaults adjusted by per-person overrides.
 * Owners always keep everything so the business can never lock itself out.
 */
export function effectivePermissions(
  role: Role,
  overrides: PermissionOverrides = {},
): Set<Permission> {
  const granted = new Set<Permission>(ROLE_PERMISSIONS[role]);
  if (role === "owner" || role === "student") return granted;
  for (const [permission, allowed] of Object.entries(overrides)) {
    if (!(permission in PERMISSIONS)) continue;
    if (allowed) granted.add(permission as Permission);
    else granted.delete(permission as Permission);
  }
  return granted;
}

export function hasAny(granted: ReadonlySet<Permission>, ...needed: Permission[]): boolean {
  return needed.some((permission) => granted.has(permission));
}
