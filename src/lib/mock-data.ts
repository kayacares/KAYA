import type {
  Bundle,
  CarePackage,
  DeliveryArea,
  Product,
  Shop,
  User,
  Vendor,
} from "@/types";

/**
 * Production data policy
 * ----------------------
 * KAYA's admin portal is the single source of truth for the customer
 * catalogue. The arrays below are intentionally EMPTY in production —
 * shops, products, vendors, delivery areas, care packages, recipients
 * and orders are all created from the admin portal and persisted to
 * localStorage. Nothing is ever auto-seeded into a customer-facing
 * deployment.
 *
 * For local development / QA, populate the arrays below temporarily
 * and remember to clear them again before deploying. The staff seed
 * (DEFAULT_STAFF) is the only exception — it ships so KAYA Ops can
 * sign in to a fresh deployment without first creating staff records.
 */

export const DEFAULT_SHOPS: Shop[] = [];

/**
 * Legacy alias used by older imports that referenced `SHOPS` directly
 * (Cart, Shop pages historically pulled from this). Kept as an empty
 * array so existing imports don't crash, but the customer-facing UI
 * now reads from `useApp().shops` instead so admin-created shops
 * appear without code changes.
 */
export const SHOPS = DEFAULT_SHOPS;

/**
 * Seeded staff so KAYA Ops can sign in to a fresh deployment with
 * the published credentials. These accounts are scoped to the
 * operations portal and never appear in the customer catalogue.
 */
export const DEFAULT_STAFF: User[] = [
  {
    id: "u_super",
    role: "super_admin",
    isAdmin: true,
    firstName: "Kojo & Esi",
    lastName: "",
    name: "Kojo & Esi",
    email: "kayacareshops@gmail.com",
    password: "KayaCare2025!",
    phone: "+233 24 000 0001",
    country: "USA",
    currency: "GHS",
    phoneVerified: true,
    joinedAt: "2024-01-15T09:00:00.000Z",
  },
  {
    id: "u_ops",
    role: "ops",
    isAdmin: true,
    firstName: "Nana",
    lastName: "",
    name: "Nana",
    email: "mykayaops@gmail.com",
    password: "Kayaops2026!",
    phone: "+233 24 000 0003",
    country: "USA",
    currency: "GHS",
    phoneVerified: true,
    joinedAt: "2024-03-05T09:30:00.000Z",
  },
];

// Customer seed: empty. Customers sign up through the live login flow
// and are persisted to localStorage on first sign-in.
export const DEFAULT_CUSTOMERS: User[] = [];

// Vendor seed: empty. Add vendors via Admin → Vendors.
export const DEFAULT_VENDORS: Vendor[] = [];

// Delivery area seed: empty. Add serviceable Town/Areas via Admin → Delivery.
export const DEFAULT_DELIVERY_AREAS: DeliveryArea[] = [];

// Product seed: empty. Create products via Admin → Products (or bulk
// import an .xlsx file via the import wizard).
export const DEFAULT_PRODUCTS: Product[] = [];

// Care package seed: empty. Build packages via Admin → Care Packages.
export const DEFAULT_CARE_PACKAGES: CarePackage[] = [];

// Legacy Bundle seed: empty. The Bundle concept has been replaced by
// the first-class Care Package entity; this export is kept only so
// the legacy `/bundle/:id` route doesn't crash on import.
export const BUNDLES: Bundle[] = [];
