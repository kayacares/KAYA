import type { User, UserRole } from "@/types";

/**
 * Fine-grained permission identifiers used to gate every sensitive
 * admin action across the KAYA Ops portal. Components call `can()` to
 * decide whether to render UI; AppContext functions call `can()` (via
 * the `deny` helper) to enforce at the data layer.
 */
export type Permission =
  // Dashboard & analytics
  | "dashboard.view"
  | "financials.view"
  // Staff management (super admin only)
  | "staff.manage"
  // Platform settings (super admin only)
  | "settings.edit"
  | "fees.edit"
  | "pricing.edit"
  // Shops
  | "shops.view"
  | "shops.create"
  | "shops.edit"
  | "shops.delete"
  | "shops.upload_image"
  // Products
  | "products.view"
  | "products.create"
  | "products.edit"
  | "products.delete"
  | "products.availability"
  // Vendors
  | "vendors.view"
  | "vendors.create"
  | "vendors.edit"
  | "vendors.delete"
  | "vendors.assign"
  // Delivery areas (editable Town / Area list for recipient addresses)
  | "delivery_areas.view"
  | "delivery_areas.manage"
  // Care Packages (curated cross-shop gifts — first-class admin entity)
  | "care_packages.view"
  | "care_packages.create"
  | "care_packages.edit"
  | "care_packages.delete"
  | "care_packages.upload_image"
  // Orders
  | "orders.view"
  | "orders.update_status"
  | "orders.add_note"
  | "orders.upload_photo"
  | "orders.cancel"
  | "orders.refund"
  | "orders.substitute"
  | "orders.flag_attention"
  // Customers
  | "customers.view"
  | "customers.manage"
  // Recipients
  | "recipients.view"
  // Waitlist
  | "waitlist.view"
  | "waitlist.export"
  // Investigations
  | "investigations.view"
  | "investigations.resolve"
  // Audit log
  | "audit.view"
  // Data export
  | "data.export";

const SUPER_ADMIN_PERMS = new Set<Permission>([
  "dashboard.view", "financials.view",
  "staff.manage",
  "settings.edit", "fees.edit", "pricing.edit",
  "shops.view", "shops.create", "shops.edit", "shops.delete", "shops.upload_image",
  "products.view", "products.create", "products.edit", "products.delete", "products.availability",
  "vendors.view", "vendors.create", "vendors.edit", "vendors.delete", "vendors.assign",
  "delivery_areas.view", "delivery_areas.manage",
  "care_packages.view", "care_packages.create", "care_packages.edit", "care_packages.delete", "care_packages.upload_image",
  "orders.view", "orders.update_status", "orders.add_note", "orders.upload_photo",
  "orders.cancel", "orders.refund", "orders.substitute", "orders.flag_attention",
  "customers.view", "customers.manage",
  "recipients.view",
  "waitlist.view", "waitlist.export",
  "investigations.view", "investigations.resolve",
  "audit.view",
  "data.export",
]);

const ADMIN_PERMS = new Set<Permission>([
  "dashboard.view",
  // ❌ financials.view, staff.manage, settings.edit, fees.edit, pricing.edit
  "shops.view", "shops.create", "shops.edit", "shops.upload_image",
  // ❌ shops.delete
  "products.view", "products.create", "products.edit", "products.availability",
  // ❌ products.delete
  "vendors.view", "vendors.create", "vendors.edit", "vendors.assign",
  // ❌ vendors.delete
  "delivery_areas.view", "delivery_areas.manage",
  "care_packages.view", "care_packages.create", "care_packages.edit", "care_packages.upload_image",
  // ❌ care_packages.delete (Super Admin only)
  "orders.view", "orders.update_status", "orders.add_note", "orders.upload_photo",
  "orders.cancel", "orders.substitute", "orders.flag_attention",
  // ❌ orders.refund (Super Admin only)
  "customers.view", "customers.manage",
  "recipients.view",
  "waitlist.view",
  // ❌ waitlist.export
  "investigations.view", "investigations.resolve",
  // ❌ audit.view, data.export
]);

const OPS_PERMS = new Set<Permission>([
  // ❌ dashboard.view (lands on Orders), financials.view
  "orders.view", "orders.update_status", "orders.add_note", "orders.upload_photo",
  "orders.substitute", "orders.flag_attention",
  // ❌ orders.cancel / orders.refund (Manager or Super only)
  "vendors.view", "vendors.assign",
  // ❌ vendors.create / edit / delete
  "delivery_areas.view",
  // ❌ delivery_areas.manage (Manager+ only)
  "care_packages.view",
  // ❌ care_packages.create / edit / delete (Manager+ only)
  "products.view", "products.availability",
  // ❌ products.create / edit / delete (read + availability toggle only)
  "recipients.view",
  "investigations.view", "investigations.resolve",
  // ❌ customers, shops, pricing, waitlist
]);

const CUSTOMER_PERMS = new Set<Permission>([]);

const PERMS_BY_ROLE: Record<UserRole, Set<Permission>> = {
  super_admin: SUPER_ADMIN_PERMS,
  admin: ADMIN_PERMS,
  ops: OPS_PERMS,
  customer: CUSTOMER_PERMS,
};

/** Resolves a user's effective role with backwards-compat fallback. */
export function getRole(user: User | null | undefined): UserRole {
  if (!user) return "customer";
  return user.role ?? (user.isAdmin ? "admin" : "customer");
}

/** True when the given user has the given permission. */
export function can(perm: Permission, user: User | null | undefined): boolean {
  if (!user) return false;
  return PERMS_BY_ROLE[getRole(user)]?.has(perm) ?? false;
}

/** True when the user has at least one of the listed permissions. */
export function canAny(
  perms: Permission[],
  user: User | null | undefined
): boolean {
  return perms.some((p) => can(p, user));
}

/** Human-readable role label for headers, chips and audit log rows. */
export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Manager",
  ops: "Operations Coordinator",
  customer: "Customer",
};

/** Tailwind classes for the role chip — used in headers and tables. */
export const ROLE_BADGE: Record<UserRole, string> = {
  super_admin: "bg-charcoal-900 text-mustard-400",
  admin: "bg-mustard-400 text-charcoal-900",
  ops: "bg-sage-300 text-charcoal-900",
  customer: "bg-cream-200 text-charcoal-700",
};

/** One-line description of what each role can do. Used in Staff tab + docs. */
export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  super_admin:
    "Full access. Staff management, refunds, deletions, platform settings, financial exports.",
  admin:
    "Day-to-day Manager. Shops, products, vendors, delivery areas, customers, orders, substitutions, cancellations. No deletes, refunds or exports.",
  ops:
    "Fulfillment & support. Orders, vendor assignment, delivery photos, product availability, substitutions, investigations, delivery area visibility.",
  customer: "Standard customer experience — no admin access.",
};
