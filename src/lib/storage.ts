export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const STORAGE_KEYS = {
  user: "kaya.user",
  customers: "kaya.customers",
  recipients: "kaya.recipients",
  cart: "kaya.cart",
  cartMessage: "kaya.cartMessage",
  cartBundleId: "kaya.cartBundleId",
  orders: "kaya.orders",
  vendors: "kaya.vendors",
  products: "kaya.products",
  shops: "kaya.shops",
  brandHero: "kaya.brandHero",
  notifications: "kaya.notifications",
  waitlist: "kaya.waitlist",
  referralShares: "kaya.referralShares",
  auditLog: "kaya.auditLog",
  highValueThreshold: "kaya.highValueThreshold",
  deliveryAreas: "kaya.deliveryAreas",
  // Tombstones — arrays of IDs for seeded default entities that
  // admins have explicitly deleted. Without these, the AppContext
  // auto-merge loader would silently re-add any DEFAULT_PRODUCTS /
  // DEFAULT_SHOPS / DEFAULT_VENDORS / DEFAULT_DELIVERY_AREAS not
  // present in storage on every page reload, undoing the deletion.
  deletedProductIds: "kaya.deletedProductIds",
  deletedShopIds: "kaya.deletedShopIds",
  deletedVendorIds: "kaya.deletedVendorIds",
  deletedDeliveryAreaIds: "kaya.deletedDeliveryAreaIds",
  deliveryScheduleConfig: "kaya.deliveryScheduleConfig",
  // Care packages — admin-managed curated cross-shop gifts (the
  // first-class replacement for the legacy hard-coded Bundle list).
  carePackages: "kaya.carePackages",
  deletedCarePackageIds: "kaya.deletedCarePackageIds",
};

/**
 * Bump this whenever a breaking schema or data-policy change ships.
 * Every `kaya.*` localStorage key is wiped on the next boot when the
 * stored version doesn't match, so testers and existing customers
 * always start the new release from a clean slate.
 *
 * v5-supabase-catalog (2026-Q3): the customer-facing catalogue
 * (shops, products, vendors, delivery areas, care packages) now
 * lives in a shared Supabase database so the Admin Portal is the
 * single source of truth across every device.
 *
 * v6-supabase-orders-staff (2026-Q3): the order pipeline and the
 * staff / admin accounts also moved to shared Supabase tables
 * (public.orders, public.staff_members). Customer signups still
 * live in localStorage on the device they signed up from; staff
 * additions / edits / removals propagate to every browser within
 * ~30s (next poll/focus tick).
 *
 * v7-supabase-customers-recipients (2026-Q3): customer signups
 * and their saved recipients (loved ones) also moved to shared
 * Supabase tables (public.customers, public.recipients). A
 * customer who signs up on Phone A can now sign in from Laptop B
 * and pick up their currency, referral credit and saved
 * recipients without losing anything. Admin Recipients tab sees
 * the global view; customers only ever see their own.
 *
 * The version bump wipes any per-browser customer + recipient
 * snapshot from the previous v6 build so every device boots from
 * the live DB on first load after deploy.
 */
export const STORAGE_VERSION = "v7-supabase-customers-recipients";
export const STORAGE_VERSION_KEY = "kaya.version";

export function runStorageMigration(): void {
  if (typeof window === "undefined") return;
  try {
    const current = window.localStorage.getItem(STORAGE_VERSION_KEY);
    if (current === STORAGE_VERSION) return;
    // Wipe every known KAYA key plus any stray "kaya.*" entries from older
    // builds so users boot into a fully clean pre-launch experience.
    Object.values(STORAGE_KEYS).forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore quota / privacy errors */
      }
    });
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("kaya.") && k !== STORAGE_VERSION_KEY) {
        try {
          window.localStorage.removeItem(k);
        } catch {
          /* ignore */
        }
      }
    }
    window.localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  } catch {
    /* localStorage unavailable — proceed with in-memory defaults */
  }
}
