import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type {
  AuditLogEntry,
  CarePackage,
  CartLine,
  Country,
  DeliveryArea,
  DeliverySchedule,
  DeliveryScheduleConfig,
  DeliveryWindow,
  LocationConfirmation,
  Notification,
  NotificationType,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductAvailability,
  Recipient,
  ReferralShareChannel,
  ReferralShareEvent,
  ReferralSource,
  Shop,
  ShopId,
  SubstitutionAction,
  SubstitutionPreference,
  SubstitutionRecord,
  User,
  UserRole,
  Vendor,
  WaitlistEntry,
  WaitlistSource,
} from "@/types";
import {
  STORAGE_KEYS,
  loadJSON,
  runStorageMigration,
  saveJSON,
} from "@/lib/storage";
import * as catalog from "@/lib/catalog";
import {
  fetchLocationConfirmations,
  upsertLocationConfirmation as upsertLocationConfirmationRow,
  generateConfirmationToken,
} from "@/lib/locationConfirmations";
import { DEFAULT_STAFF } from "@/lib/mock-data";
import { uid } from "@/lib/utils";
import { formatGHS } from "@/lib/currency";
import {
  REFERRAL_CREDIT_GHS,
  generateReferralCode,
  normalizeReferralCode,
} from "@/lib/referral";
import { can, getRole, type Permission } from "@/lib/permissions";
import { supabase, getActiveWriteCount } from "@/lib/supabase";
import {
  DEFAULT_DELIVERY_SCHEDULE_CONFIG,
  formatScheduledDate,
} from "@/lib/deliverySchedule";

// Re-export so consumers can pull the type alongside the runtime hook.
export type { DeliverySchedule };

// Wipe legacy demo data + stale staff records on storage version change.
runStorageMigration();

const AUDIT_LOG_MAX = 1000;

/**
 * Server-wins merge keyed by id. Returns a new array containing:
 *   - Every row from `server` (server is source of truth).
 *   - Any row in `local` whose id doesn't exist on the server
 *     (preserves optimistic additions that haven't fully replicated
 *     yet, or that were saved offline).
 *
 * Order: server rows first (in server order), then local-only rows
 * in their original relative order. Consumers that need a specific
 * order (e.g. DeliveryAreasTab sorts by city + name) re-sort in a
 * useMemo, so we don't try to be clever here.
 *
 * ⚠️ Do NOT change this to a full replace. See the "MERGE-INSTEAD-
 * OF-REPLACE" note above for the recurring bug this prevents.
 */
function mergeById<T extends { id: string }>(server: T[], local: T[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const s of server) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    merged.push(s);
  }
  for (const l of local) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    merged.push(l);
  }
  return merged;
}

// v5 — The customer-facing catalogue (shops, products, vendors,
// delivery areas, care packages) now lives in a shared Supabase
// database and is fetched by the sync useEffect below via one
// Promise.allSettled call per entity, so a single failure in any
// endpoint never freezes the rest on stale localStorage data.
//
// ⚠️ MERGE-INSTEAD-OF-REPLACE (fixed 2026-Q3, do not regress):
// Every entity sync uses `mergeById` below so a poll that returns
// a stale snapshot (row hasn't fully replicated yet, PostgREST
// hit a read replica, upsert response was empty due to RLS on
// RETURNING, etc.) can never wipe an optimistically-added row
// from local state. Server rows still win on id collision — so
// the moment the server catches up its version overwrites the
// local placeholder with identical data. Recurring bug this
// fixes: "delivery area saved to DB but disappears from UI
// within seconds" — the sync was replacing state before the
// polled fetch reliably included the just-written row.
// Writes hit Supabase via `catalog.upsertXRow` / `catalog.deleteXRow`
// immediately after the optimistic local update, then the next
// poll/focus refresh in every other open browser picks up the
// change.

interface SignInResult {
  ok: boolean;
  error?: string;
  user?: User;
}

interface AppContextType {
  user: User | null;
  login: (data: Omit<User, "id">) => User;
  signInAs: (u: User) => void;
  signInWithCredentials: (email: string, password: string) => SignInResult;
  logout: () => void;
  setUser: (u: User) => void;
  respondToReferralPrompt: (source: ReferralSource | null) => void;
  /** Update the saved substitution preference on the current user. */
  setUserSubstitutionPreference: (pref: SubstitutionPreference) => void;
  /** Send a Supabase password reset email (no actor required). */
  requestPasswordReset: (
    email: string
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Set a new password after a successful PASSWORD_RECOVERY session. */
  completePasswordReset: (
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  customers: User[];
  addStaffMember: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: UserRole;
    password: string;
  }) => SignInResult;
  removeStaffMember: (id: string) => boolean;
  resetStaffPassword: (id: string, newPassword: string) => boolean;
  updateStaffEmail: (
    id: string,
    newEmail: string
  ) => { ok: boolean; error?: string };
  recipients: Recipient[];
  addRecipient: (r: Omit<Recipient, "id" | "createdAt">) => Recipient;
  updateRecipient: (id: string, patch: Partial<Recipient>) => void;
  removeRecipient: (id: string) => void;
  cart: CartLine[];
  activeRecipientId: string | null;
  setActiveRecipient: (id: string | null) => void;
  addToCart: (productId: string, qty?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartMessage: string;
  setCartMessage: (m: string) => void;
  cartBundleId: string | null;
  setCartBundleId: (id: string | null) => void;
  shops: Shop[];
  updateShop: (id: ShopId, patch: Partial<Shop>) => void;
  addShop: (shop: Shop) => void;
  deleteShop: (id: ShopId) => void;
  products: Product[];
  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  setProductAvailability: (
    id: string,
    availability: ProductAvailability
  ) => void;
  vendors: Vendor[];
  upsertVendor: (v: Vendor) => void;
  deleteVendor: (id: string) => void;
  deliveryAreas: DeliveryArea[];
  upsertDeliveryArea: (area: DeliveryArea) => void;
  removeDeliveryArea: (id: string) => void;
  carePackages: CarePackage[];
  upsertCarePackage: (pkg: CarePackage) => void;
  duplicateCarePackage: (id: string) => void;
  deleteCarePackage: (id: string) => void;
  setCarePackageStatus: (id: string, status: CarePackage["status"]) => void;
  setCarePackageFeatured: (id: string, featured: boolean) => void;
  deliveryScheduleConfig: DeliveryScheduleConfig;
  updateDeliveryScheduleConfig: (
    patch: Partial<DeliveryScheduleConfig>
  ) => void;
  upsertDeliveryWindow: (window: DeliveryWindow) => void;
  removeDeliveryWindow: (id: string) => void;
  orders: Order[];
  createOrder: (o: Omit<Order, "id" | "createdAt" | "status" | "history">) => Order;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  assignVendor: (id: string, vendorId: string) => void;
  setRecipientConfirm: (id: string, value: "yes" | "no") => void;
  setDeliveryPhoto: (id: string, url: string) => void;
  cancelOrder: (
    id: string,
    reason?: string,
    options?: { notifyCustomer?: boolean }
  ) => void;
  refundOrder: (
    id: string,
    reason?: string,
    options?: { amountGHS?: number; notifyCustomer?: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  recordSubstitution: (
    orderId: string,
    data: {
      originalProductId: string;
      action: "substituted" | "removed" | "approval_pending";
      replacementProductId?: string;
      replacementQuantity?: number;
      reason: string;
    }
  ) => { ok: boolean; error?: string };
  approveSubstitution: (
    orderId: string,
    substitutionId: string,
    approved: boolean
  ) => void;
  setAdminNote: (id: string, note: string) => void;
  brandHeroUrl: string;
  setBrandHeroUrl: (url: string) => void;
  highValueThresholdGHS: number;
  setHighValueThreshold: (amount: number) => void;
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  waitlistEntries: WaitlistEntry[];
  addWaitlistEntry: (
    entry: Omit<WaitlistEntry, "id" | "createdAt">
  ) => WaitlistEntry | null;
  isOnWaitlist: boolean;
  referralShares: ReferralShareEvent[];
  recordReferralShare: (channel: ReferralShareChannel) => void;
  auditLog: AuditLogEntry[];
  recordAudit: (
    entry: Omit<AuditLogEntry, "id" | "at" | "actorId" | "actorName" | "actorRole">
  ) => void;
  /** Every location_confirmation row visible to the current session. */
  locationConfirmations: LocationConfirmation[];
  /**
   * Ensures a pending location confirmation exists for the given
   * order. Returns the existing record if there already is one, or
   * creates a fresh one (with URL-safe token) and returns it. Returns
   * `null` when the order's recipient already has a verified GPS pin
   * on file so no request is needed.
   */
  ensureLocationConfirmation: (
    order: Order
  ) => Promise<LocationConfirmation | null>;
  /** Records that the WhatsApp / SMS link was just sent to the recipient. */
  markLocationConfirmationNotified: (id: string) => void;
  /** Flag a confirmation for follow-up with an optional ops note. */
  flagLocationConfirmationForFollowup: (id: string, note?: string) => void;
  /** Move a needs_followup confirmation back to pending. */
  resolveLocationConfirmationFollowup: (id: string) => void;
  /**
   * Sign up a new customer with email + password via Supabase Auth,
   * create the matching customer profile row, apply any referral
   * credit and sign the browser in. If Supabase requires email
   * confirmation the customer stays signed-out and `needsEmailConfirmation`
   * is returned so the UI can prompt them to check their inbox.
   */
  signUpWithEmail: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    country: Country;
    referralCode?: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    user?: User;
    needsEmailConfirmation?: boolean;
  }>;
  /** Sign in a customer with email + password via Supabase Auth. */
  signInCustomerWithEmail: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; user?: User }>;
  /** Kick off the Google OAuth redirect — browser navigates away. */
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  /** Send a Supabase password-reset email to a customer address. */
  requestCustomerPasswordReset: (
    email: string
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Complete a customer password reset after opening the email link. */
  completeCustomerPasswordReset: (
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Resend the sign-up verification email for a customer address.
   * Used on the "check your email" screen after a successful signup
   * so customers who never received the first email (spam folder,
   * typo, slow SMTP) can get a fresh link without abandoning the
   * flow. Supabase enforces its own rate limits and surfaces them
   * in the returned error message.
   */
  resendEmailVerification: (
    email: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

const Ctx = createContext<AppContextType | null>(null);

const STATUS_MIGRATION: Record<string, OrderStatus> = {
  New: "Paid",
  Processing: "Being Prepared",
  Investigation: "Flagged for Investigation",
};

function migrateOrder(o: Order): Order {
  const status = (STATUS_MIGRATION[o.status as any] ?? o.status) as OrderStatus;
  const history = (o.history ?? []).map((h) => ({
    ...h,
    status: (STATUS_MIGRATION[h.status as any] ?? h.status) as OrderStatus,
  }));
  return { ...o, status, history };
}

function migrateUser(u: User | null): User | null {
  if (!u) return null;
  const patched: User = { ...u };
  if (!patched.role) patched.role = u.isAdmin ? "admin" : "customer";
  if (!patched.referralCode) {
    patched.referralCode = generateReferralCode(
      patched.firstName || patched.name || "K"
    );
  }
  if (patched.pendingCreditGHS == null) patched.pendingCreditGHS = 0;
  if (patched.referralsCount == null) patched.referralsCount = 0;
  return patched;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    const loaded = migrateUser(loadJSON<User | null>(STORAGE_KEYS.user, null));
    // Sign out anyone still authenticated as the retired u_admin seed —
    // Admin and Super Admin now share a single kayacareshops@gmail.com
    // login so the standalone u_admin record has been removed.
    if (loaded?.id === "u_admin") return null;
    return loaded;
  });

  // ⚠️ ACTIVE-USER REF (fixed 2026-Q3, do not regress):
  // Mirrors the current React user into a ref so the auth listener
  // callbacks below (syncCustomerFromSupabaseAuth, getSession, and
  // onAuthStateChange) can gate on the LIVE user, not a potentially-
  // stale localStorage snapshot. Without this, a staff sign-in races
  // the Supabase SIGNED_IN event: StaffLogin calls signInWithPassword,
  // Supabase fires SIGNED_IN before StaffLogin.saveJSON writes the
  // staff record to localStorage, the listener reads null/customer
  // from disk, treats the session as a customer sign-in, and
  // overwrites setUserState with a customer profile — locking the
  // operator out of /admin with a "Staff access only" screen even
  // though their write to Supabase succeeded.
  const userRef = useRef<User | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [customers, setCustomers] = useState<User[]>(() => {
    const stored = loadJSON<User[] | null>(STORAGE_KEYS.customers, null);
    if (!stored || stored.length === 0) return [...DEFAULT_STAFF];
    // Always refresh seeded staff records so password / email changes
    // in mock-data.ts propagate without forcing a manual reset. Also drop
    // any retired default-staff IDs (u_admin was consolidated into
    // u_super) so existing testers don't see a phantom account.
    const RETIRED_STAFF_IDS = new Set(["u_admin"]);
    const cleaned = stored.filter((u) => !RETIRED_STAFF_IDS.has(u.id));
    const staffIds = new Set(DEFAULT_STAFF.map((s) => s.id));
    const nonStaff = cleaned.filter((u) => !staffIds.has(u.id));
    return [...DEFAULT_STAFF, ...nonStaff];
  });
  const [recipients, setRecipients] = useState<Recipient[]>(() =>
    loadJSON<Recipient[]>(STORAGE_KEYS.recipients, [])
  );
  const [cart, setCart] = useState<CartLine[]>(() =>
    loadJSON<CartLine[]>(STORAGE_KEYS.cart, [])
  );
  const [cartMessage, setCartMessageState] = useState<string>(() =>
    loadJSON<string>(STORAGE_KEYS.cartMessage, "")
  );
  const [cartBundleId, setCartBundleIdState] = useState<string | null>(() =>
    loadJSON<string | null>(STORAGE_KEYS.cartBundleId, null)
  );
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  // (Catalog tombstone state removed in v5 — Supabase is the single
  // source of truth for shops / products / vendors / delivery areas /
  // care packages, so deletes hit the DB directly and never need to
  // be re-suppressed against an in-code default.)
  // Care packages — admin-managed, no auto-seeding. Admin portal is
  // the single source of truth; loader just reads from storage so
  // anything the admin deletes stays deleted across reloads.
  const [carePackages, setCarePackages] = useState<CarePackage[]>(() =>
    loadJSON<CarePackage[]>(STORAGE_KEYS.carePackages, [])
  );
  // Shops — admin-managed, no auto-seeding. Admin portal is the single
  // source of truth; loader just reads from storage so a shop the
  // admin deletes stays deleted across reloads.
  const [shops, setShops] = useState<Shop[]>(() =>
    loadJSON<Shop[]>(STORAGE_KEYS.shops, [])
  );
  // Products — admin-managed, no auto-seeding. The only logic kept
  // here is the schema migration (legacy `active` -> `availability`
  // tri-state, legacy `vendorId` -> `vendorIds[]` multi-vendor) so
  // existing localStorage payloads keep rendering after the schema
  // evolved. Default products are NOT re-injected; anything the admin
  // deletes stays deleted across reloads.
  const [products, setProducts] = useState<Product[]>(() => {
    const migrateProduct = (p: Product): Product => ({
      ...p,
      availability:
        p.availability ?? (p.active ? "active" : "inactive"),
      vendorIds:
        p.vendorIds && p.vendorIds.length > 0
          ? p.vendorIds
          : p.vendorId
          ? [p.vendorId]
          : [],
    });
    return loadJSON<Product[]>(STORAGE_KEYS.products, []).map(
      migrateProduct
    );
  });
  // Vendors — admin-managed, no auto-seeding.
  const [vendors, setVendors] = useState<Vendor[]>(() =>
    loadJSON<Vendor[]>(STORAGE_KEYS.vendors, [])
  );
  // Delivery areas — admin-managed, no auto-seeding.
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>(() =>
    loadJSON<DeliveryArea[]>(STORAGE_KEYS.deliveryAreas, [])
  );
  const [deliveryScheduleConfig, setDeliveryScheduleConfig] =
    useState<DeliveryScheduleConfig>(() => {
      const stored = loadJSON<DeliveryScheduleConfig | null>(
        STORAGE_KEYS.deliveryScheduleConfig,
        null
      );
      if (!stored) return { ...DEFAULT_DELIVERY_SCHEDULE_CONFIG };
      // Merge \u2014 preserve admin overrides while guaranteeing every
      // field exists so older stored payloads don't crash the picker.
      return {
        windows:
          stored.windows && stored.windows.length > 0
            ? stored.windows
            : DEFAULT_DELIVERY_SCHEDULE_CONFIG.windows,
        sameDayCutoffHour:
          typeof stored.sameDayCutoffHour === "number"
            ? stored.sameDayCutoffHour
            : DEFAULT_DELIVERY_SCHEDULE_CONFIG.sameDayCutoffHour,
        daysAvailable:
          stored.daysAvailable && stored.daysAvailable.length > 0
            ? stored.daysAvailable
            : DEFAULT_DELIVERY_SCHEDULE_CONFIG.daysAvailable,
        bookingHorizonDays:
          typeof stored.bookingHorizonDays === "number"
            ? stored.bookingHorizonDays
            : DEFAULT_DELIVERY_SCHEDULE_CONFIG.bookingHorizonDays,
      };
    });
  const [orders, setOrders] = useState<Order[]>(() =>
    loadJSON<Order[]>(STORAGE_KEYS.orders, []).map(migrateOrder)
  );
  const [highValueThresholdGHS, setHighValueThresholdState] =
    useState<number>(() =>
      loadJSON<number>(STORAGE_KEYS.highValueThreshold, 300)
    );
  const [brandHeroUrl, setBrandHeroUrlState] = useState<string>(() =>
    loadJSON<string>(STORAGE_KEYS.brandHero, "")
  );
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    loadJSON<Notification[]>(STORAGE_KEYS.notifications, [])
  );
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>(() =>
    loadJSON<WaitlistEntry[]>(STORAGE_KEYS.waitlist, [])
  );
  const [referralShares, setReferralShares] = useState<ReferralShareEvent[]>(
    () => loadJSON<ReferralShareEvent[]>(STORAGE_KEYS.referralShares, [])
  );
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() =>
    loadJSON<AuditLogEntry[]>(STORAGE_KEYS.auditLog, [])
  );
  // Location confirmations — Supabase-backed, no localStorage cache.
  // Each row represents an outstanding "please pin your delivery
  // location" request the recipient can complete from a WhatsApp /
  // SMS link. Reads and writes go directly against the shared
  // public.location_confirmations table so ops sees the freshest
  // state on every poll / focus tick.
  const [locationConfirmations, setLocationConfirmations] = useState<
    LocationConfirmation[]
  >([]);

  useEffect(() => saveJSON(STORAGE_KEYS.user, user), [user]);
  useEffect(() => saveJSON(STORAGE_KEYS.customers, customers), [customers]);
  useEffect(() => {
    // Recipients are owned per-user; only cache what the current
    // user is allowed to see so localStorage on a customer device
    // never holds another customer's address book even though the
    // sync effect populates the in-memory state with the full
    // global list (so admin RecipientsTab works without a separate
    // round-trip).
    if (!user) {
      saveJSON(STORAGE_KEYS.recipients, []);
      return;
    }
    if (getRole(user) === "customer") {
      const own = recipients.filter(
        (r) => !r.userId || r.userId === user.id
      );
      saveJSON(STORAGE_KEYS.recipients, own);
    } else {
      saveJSON(STORAGE_KEYS.recipients, recipients);
    }
  }, [recipients, user]);
  useEffect(() => saveJSON(STORAGE_KEYS.cart, cart), [cart]);
  useEffect(() => saveJSON(STORAGE_KEYS.cartMessage, cartMessage), [cartMessage]);
  useEffect(() => saveJSON(STORAGE_KEYS.cartBundleId, cartBundleId), [cartBundleId]);
  useEffect(() => saveJSON(STORAGE_KEYS.shops, shops), [shops]);
  useEffect(() => saveJSON(STORAGE_KEYS.products, products), [products]);
  useEffect(() => saveJSON(STORAGE_KEYS.vendors, vendors), [vendors]);
  useEffect(
    () => saveJSON(STORAGE_KEYS.deliveryAreas, deliveryAreas),
    [deliveryAreas]
  );
  useEffect(
    () =>
      saveJSON(
        STORAGE_KEYS.deliveryScheduleConfig,
        deliveryScheduleConfig
      ),
    [deliveryScheduleConfig]
  );
  useEffect(() => saveJSON(STORAGE_KEYS.orders, orders), [orders]);
  useEffect(
    () => saveJSON(STORAGE_KEYS.highValueThreshold, highValueThresholdGHS),
    [highValueThresholdGHS]
  );
  useEffect(() => saveJSON(STORAGE_KEYS.brandHero, brandHeroUrl), [brandHeroUrl]);
  useEffect(() => saveJSON(STORAGE_KEYS.notifications, notifications), [notifications]);
  useEffect(() => saveJSON(STORAGE_KEYS.waitlist, waitlistEntries), [waitlistEntries]);
  useEffect(() => saveJSON(STORAGE_KEYS.referralShares, referralShares), [referralShares]);
  useEffect(() => saveJSON(STORAGE_KEYS.auditLog, auditLog), [auditLog]);
  useEffect(
    () => saveJSON(STORAGE_KEYS.carePackages, carePackages),
    [carePackages]
  );

  // =========== Shared Catalog Sync (Supabase) ===========
  // The customer-facing catalogue (shops, products, vendors,
  // delivery areas, care packages) lives in a shared Supabase
  // database so the Admin Portal is the single source of truth
  // across every device. This effect fetches everything on mount,
  // then again every 20 seconds (while the tab is visible), on
  // visibilitychange when the tab returns to focus, and
  // immediately when the browser reconnects after going offline.
  // As a result a shop created in the Admin Portal on Browser A
  // appears in Browser B within seconds — without any page reload
  // — and persists across deletions, refreshes and device switches.
  //
  // The localStorage saves above act as a fast-paint cache for the
  // first render before the network request lands. Once the first
  // successful fetch completes for an entity, its state is fully
  // replaced with the server truth so admin deletes propagate
  // correctly.
  //
  // ⚠️ RESILIENCE CONTRACT (fixed 2026-Q3, do not regress):
  // Every entity is fetched INDEPENDENTLY via Promise.allSettled
  // so a single failure (network hiccup on one endpoint, transient
  // Supabase blip, RLS misconfig on one table, browser cache issue
  // on one file) never cascades to the entire sync. Previously
  // this used Promise.all with a nested Promise.all inside
  // fetchCatalog — so ANY of 11 potential failures froze every
  // other entity on stale localStorage data (recurring bug where
  // admin product / delivery-area edits didn't reach customer
  // devices). If you touch this loop, keep the settled-per-entity
  // pattern or that bug will silently return.
  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const reload = async () => {
      // ⚠️ RACE-CONDITION GUARD (fixed 2026-Q3, do not regress):
      // Skip this cycle if any admin write is in flight. The fetch
      // below would otherwise return the pre-write server state and
      // its setX(server) calls would wipe the optimistic local
      // update AND overwrite localStorage — users saw this as
      // "added item appears briefly then disappears on reload"
      // because their localStorage got clobbered before the DB
      // committed. The counter is maintained by trackWrite() in
      // src/lib/supabase.ts and every write function in catalog.ts
      // and locationConfirmations.ts routes through it. Any write
      // holds the counter for 2s AFTER it resolves so an already-
      // in-flight poll can't race the DB commit. See the full
      // rationale in src/lib/supabase.ts.
      if (getActiveWriteCount() > 0) return;
      const results = await Promise.allSettled([
        catalog.fetchShops(),
        catalog.fetchProducts(),
        catalog.fetchVendors(),
        catalog.fetchDeliveryAreas(),
        catalog.fetchCarePackages(),
        catalog.fetchOrders(),
        catalog.fetchStaff(),
        catalog.fetchCustomers(),
        catalog.fetchRecipients(),
        fetchLocationConfirmations(),
      ]);
      if (!mounted) return;

      const [
        shopsRes,
        productsRes,
        vendorsRes,
        areasRes,
        cpRes,
        ordersRes,
        staffRes,
        customersRes,
        recipientsRes,
        lcRes,
      ] = results;

      // Shops — MERGE (server wins, preserve local-only optimistic rows).
      if (shopsRes.status === "fulfilled") {
        const fresh = shopsRes.value;
        setShops((prev) => mergeById(fresh, prev));
      } else {
        console.warn("[KAYA] Shops sync failed:", shopsRes.reason);
      }

      // Products — MERGE so an admin edit that already landed locally
      // isn't wiped by a stale poll before the DB replica catches up.
      if (productsRes.status === "fulfilled") {
        const fresh = productsRes.value;
        setProducts((prev) => mergeById(fresh, prev));
      } else {
        console.warn(
          "[KAYA] Products sync failed:",
          productsRes.reason
        );
      }

      // Vendors — MERGE.
      if (vendorsRes.status === "fulfilled") {
        const fresh = vendorsRes.value;
        setVendors((prev) => mergeById(fresh, prev));
      } else {
        console.warn(
          "[KAYA] Vendors sync failed:",
          vendorsRes.reason
        );
      }

      // Delivery areas — MERGE. This is the entity where the
      // "saved-but-disappears" bug was first observed; the merge
      // guarantees a newly-added town cannot be wiped by a poll
      // whose response is briefly missing the row.
      if (areasRes.status === "fulfilled") {
        const fresh = areasRes.value;
        console.log(
          "[KAYA] Delivery areas sync poll fetched:",
          fresh.length,
          "rows"
        );
        setDeliveryAreas((prev) => {
          const merged = mergeById(fresh, prev);
          console.log(
            "[KAYA] Delivery areas sync merged: prev=",
            prev.length,
            "fresh=",
            fresh.length,
            "merged=",
            merged.length
          );
          return merged;
        });
      } else {
        console.warn(
          "[KAYA] Delivery areas sync failed:",
          areasRes.reason
        );
      }

      // Care packages — MERGE.
      if (cpRes.status === "fulfilled") {
        const fresh = cpRes.value;
        setCarePackages((prev) => mergeById(fresh, prev));
      } else {
        console.warn(
          "[KAYA] Care packages sync failed:",
          cpRes.reason
        );
      }

      // Orders — MERGE (with legacy status migration on server rows).
      if (ordersRes.status === "fulfilled") {
        const fresh = ordersRes.value.map(migrateOrder);
        setOrders((prev) => mergeById(fresh, prev));
      } else {
        console.warn(
          "[KAYA] Orders sync failed:",
          ordersRes.reason
        );
      }

      // Combine staff + customers from Supabase, dedupe by id and
      // preserve any local-only entries still syncing (e.g. a
      // customer who just signed up before the fire-and-forget
      // upsert landed). Order matters: prev first (preserves
      // local-only), then customers, then staff — staff wins on
      // id collision so the staff_members table stays authoritative
      // for the operators it owns. If either fetch fails, we skip
      // the merge for that side so the local state stays intact
      // rather than being wiped by a partial refresh.
      const freshCustomers =
        customersRes.status === "fulfilled"
          ? customersRes.value
          : null;
      const freshStaff =
        staffRes.status === "fulfilled" ? staffRes.value : null;
      if (customersRes.status === "rejected") {
        console.warn(
          "[KAYA] Customers sync failed:",
          customersRes.reason
        );
      }
      if (staffRes.status === "rejected") {
        console.warn(
          "[KAYA] Staff sync failed:",
          staffRes.reason
        );
      }
      if (freshCustomers || freshStaff) {
        setCustomers((prev) => {
          const merged = new Map<string, User>();
          for (const c of prev) merged.set(c.id, c);
          if (freshCustomers)
            for (const c of freshCustomers) merged.set(c.id, c);
          if (freshStaff)
            for (const s of freshStaff) merged.set(s.id, s);
          return Array.from(merged.values());
        });
      }

      // Recipients are owned per-user but fetched globally so the
      // admin Recipients tab can audit every customer's saved
      // loved ones. The context value scopes the visible list to
      // the current customer below; the localStorage save effect
      // separately filters to the active user so a device cache
      // never holds another customer's address book.
      if (recipientsRes.status === "fulfilled") {
        const fresh = recipientsRes.value;
        setRecipients((prev) => {
          const merged = new Map<string, Recipient>();
          for (const r of prev) merged.set(r.id, r);
          for (const r of fresh) merged.set(r.id, r);
          return Array.from(merged.values());
        });
      } else {
        console.warn(
          "[KAYA] Recipients sync failed:",
          recipientsRes.reason
        );
      }

      // Location confirmations — freshest state wins on every
      // poll tick so ops immediately sees a recipient who just
      // submitted their location on their phone even if they
      // did it seconds ago.
      if (lcRes.status === "fulfilled") {
        setLocationConfirmations(lcRes.value);
      } else {
        console.warn(
          "[KAYA] Location confirmations sync failed:",
          lcRes.reason
        );
      }
    };

    void reload();
    // Polling cadence — 20s is the sweet spot for "feels live"
    // admin change propagation without noticeably increasing
    // Supabase egress. Any customer who taps back to the tab
    // (visibilitychange) or reconnects (online) gets an immediate
    // refresh regardless.
    intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 20_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onOnline = () => void reload();
    window.addEventListener("online", onOnline);

    // ⚠️ RELOAD-MID-WRITE GUARD (fixed 2026-Q3, do not regress):
    // If the admin clicks Save and immediately reloads / closes
    // the tab, an in-flight fetch to Supabase is cancelled by
    // the browser and the row never persists. The counter above
    // fixes the sync race but can't protect against a page
    // unload. Warn the user before they lose the write. Users
    // very rarely see this dialog (writes complete in <1s) but
    // when they do it protects their data.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (getActiveWriteCount() > 0) {
        e.preventDefault();
        // Modern browsers ignore this string but need it truthy
        // to actually show the confirmation dialog.
        e.returnValue = "Changes are still saving. Leave anyway?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // ============ Supabase Auth listener (customer auth) ============
  // Handles Google OAuth redirects, page-load session restoration and
  // any explicit signInWithPassword calls. Skips staff members (who
  // use app-layer auth) and no-ops when the local KAYA user already
  // matches the incoming Supabase session, and skips entirely on the
  // password-reset pages so recovery sessions don't accidentally sign
  // the user into somebody else's account.
  useEffect(() => {
    let mounted = true;

    const isOnResetPage = () => {
      if (typeof window === "undefined") return false;
      const path = window.location.pathname;
      return (
        path === "/reset-password" ||
        path === "/staff-reset-password"
      );
    };

    const syncCustomerFromSupabaseAuth = async (authUser: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    }) => {
      if (!mounted) return;
      const email = authUser.email?.toLowerCase();
      if (!email) return;

      // ⚠️ ACTIVE-STAFF-SESSION GUARD (fixed 2026-Q3, do not regress):
      // If the latest React user is already staff, DO NOT run the
      // customer sync — the incoming JWT was minted for a staff
      // sign-in and any setUserState below would strip their role
      // and lock them out of /admin with "Staff access only". This
      // closes the race where SIGNED_IN fires between StaffLogin's
      // signInWithPassword resolving and its saveJSON writing the
      // staff record to disk.
      const activeUser = userRef.current;
      if (activeUser && getRole(activeUser) !== "customer") return;

      // ⚠️ STAFF SIGN-IN GUARD (fixed 2026-Q3, do not regress):
      // If the incoming Supabase Auth email matches a staff_members
      // row, this is a staff sign-in (either via /staff-login or a
      // restored staff session on page refresh). StaffLogin.tsx
      // owns the local user state for staff, so we MUST NOT create
      // a phantom customer profile here — doing so would
      //   (a) INSERT a spurious row into public.customers keyed on
      //       the staff's auth UUID,
      //   (b) overwrite the staff React state with role="customer"
      //       via setUserState, causing the deny() checks to reject
      //       every subsequent admin write, and
      //   (c) confuse the customers list UI with a duplicate.
      // The staff table has open authenticated_select policies so
      // this lookup succeeds with any valid JWT. On ANY error we
      // BAIL DEFENSIVELY rather than risk overwriting a staff
      // session with a phantom customer profile — the auth listener
      // will get another chance on the next SIGNED_IN or
      // getSession tick.
      try {
        const { data: staffMatch, error: staffError } = await supabase
          .from("staff_members")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (staffError) {
          console.warn(
            "[KAYA] Auth sync staff-check errored — bailing to protect session:",
            staffError
          );
          return;
        }
        if (staffMatch) {
          // Staff — bail out; StaffLogin already set local state.
          return;
        }
      } catch (err) {
        console.warn(
          "[KAYA] Auth sync staff-check threw — bailing to protect session:",
          err
        );
        return;
      }

      let profile: User | undefined;
      try {
        const list = await catalog.fetchCustomers();
        profile = list.find((c) => c.email.toLowerCase() === email);
      } catch (err) {
        console.warn("[KAYA] Auth sync fetch customers failed:", err);
      }

      if (profile) {
        profile = { ...profile, lastSignInAt: new Date().toISOString() };
      } else {
        const md = (authUser.user_metadata ?? {}) as Record<
          string,
          string | undefined
        >;
        const firstName =
          md.given_name ||
          md.first_name ||
          (md.full_name || md.name || "").split(" ")[0] ||
          "";
        const lastName =
          md.family_name ||
          md.last_name ||
          (md.full_name || md.name || "").split(" ").slice(1).join(" ") ||
          "";
        const fullName =
          md.full_name ||
          md.name ||
          `${firstName} ${lastName}`.trim() ||
          email.split("@")[0];
        profile = {
          id: authUser.id,
          role: "customer",
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          name: fullName,
          email,
          phone: md.phone,
          currency: "GHS",
          country: (md.country as Country | undefined) ?? "USA",
          phoneVerified: !!md.phone,
          joinedAt: new Date().toISOString(),
          lastSignInAt: new Date().toISOString(),
          referralCode: generateReferralCode(firstName || fullName || "K"),
          pendingCreditGHS: 0,
          referralsCount: 0,
        };
      }

      try {
        await catalog.upsertCustomerRow(profile);
      } catch (err) {
        console.warn("[KAYA] Auth sync upsert customer failed:", err);
      }

      if (!mounted || !profile) return;
      // Final guard: another sign-in flow (e.g. StaffLogin's signInAs)
      // may have promoted the user to staff while our staff-check
      // await was in flight. Re-check the latest ref before writing.
      const latestUser = userRef.current;
      if (latestUser && getRole(latestUser) !== "customer") return;
      setUserState(profile);
      setCustomers((prev) => {
        const idx = prev.findIndex((c) => c.id === profile!.id);
        return idx === -1
          ? [
              profile!,
              ...prev.filter(
                (c) => c.email.toLowerCase() !== email
              ),
            ]
          : prev.map((c, i) => (i === idx ? profile! : c));
      });
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || !session?.user) return;
      if (isOnResetPage()) return;
      // Prefer the live React user (via ref) over the localStorage
      // snapshot so a staff sign-in that hasn't finished writing to
      // disk yet still short-circuits the customer sync. localStorage
      // is checked as a second layer in case the ref is null on
      // initial mount but disk already holds a staff record from a
      // prior session.
      const activeUser = userRef.current;
      if (activeUser && getRole(activeUser) !== "customer") return;
      const currentUser = loadJSON<User | null>(
        STORAGE_KEYS.user,
        null
      );
      if (currentUser && getRole(currentUser) !== "customer") return;
      if (
        currentUser?.email.toLowerCase() ===
        session.user.email?.toLowerCase()
      )
        return;
      void syncCustomerFromSupabaseAuth(session.user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY") return;
        if (isOnResetPage()) return;
        // ⚠️ TOKEN_REFRESHED / USER_UPDATED / any non-SIGNED_IN event
        // must NOT trigger the customer sync — it would clobber a
        // live staff session whose JWT just refreshed after a write.
        if (event === "SIGNED_IN" && session?.user) {
          // Ref-first guard closes the race where StaffLogin has
          // already called signInAs (setting React state) but the
          // debounced useEffect hasn't yet written to localStorage.
          const activeUser = userRef.current;
          if (activeUser && getRole(activeUser) !== "customer") return;
          const currentUser = loadJSON<User | null>(
            STORAGE_KEYS.user,
            null
          );
          if (currentUser && getRole(currentUser) !== "customer") return;
          if (
            currentUser?.email.toLowerCase() ===
            session.user.email?.toLowerCase()
          )
            return;
          void syncCustomerFromSupabaseAuth(session.user);
        }
      }
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AppContextType = useMemo(() => {
    const appendAudit = (
      actor: User,
      entry: Omit<AuditLogEntry, "id" | "at" | "actorId" | "actorName" | "actorRole">
    ) => {
      setAuditLog((prev) =>
        [
          {
            id: uid("aud"),
            at: new Date().toISOString(),
            actorId: actor.id,
            actorName: actor.name,
            actorRole: getRole(actor),
            ...entry,
          },
          ...prev,
        ].slice(0, AUDIT_LOG_MAX)
      );
    };

    /**
     * Returns true when the current `user` lacks the given permission.
     * Toasts an access-denied message AND records a denial in the audit
     * log so Super Admins can review attempted unauthorized actions.
     * Call sites should `return` immediately when this returns true.
     */
    const deny = (perm: Permission, actionLabel: string): boolean => {
      if (can(perm, user)) return false;
      if (!user) {
        toast.error("Sign in to perform this action.");
        return true;
      }
      toast.error(`Access denied — you can't ${actionLabel}.`);
      appendAudit(user, {
        category: "access",
        action: `Denied: ${actionLabel}`,
        notes: `Missing permission: ${perm}`,
      });
      return true;
    };

    const pushNotification = (
      n: Omit<Notification, "id" | "createdAt" | "read">
    ) => {
      if (!n.userId) return;
      setNotifications((prev) => [
        {
          ...n,
          id: uid("ntf"),
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    };

    const statusNotification = (
      order: Order,
      status: OrderStatus
    ): { type: NotificationType; title: string; description: string } | null => {
      const recipientName = order.recipient.fullName.split(" ")[0];
      switch (status) {
        case "Assigned to Vendor":
          return {
            type: "vendor_assigned",
            title: "Order being prepared",
            description: `KAYA is preparing care for ${recipientName}.`,
          };
        case "Out for Delivery":
          return {
            type: "out_for_delivery",
            title: "Out for delivery",
            description: `Care for ${recipientName} is on the way — tracking live.`,
          };
        case "Delivered":
          return {
            type: "delivered",
            title: "Delivered",
            description: `${recipientName} just received your care package.`,
          };
        case "Flagged for Investigation":
          return {
            type: "delivery_issue",
            title: "Delivery issue reported",
            description: `${recipientName} reported a problem — KAYA is investigating.`,
          };
        default:
          return null;
      }
    };

    const userNotifications = user
      ? notifications.filter((n) => n.userId === user.id)
      : [];
    const unreadCount = userNotifications.filter((n) => !n.read).length;
    const isOnWaitlist = !!user
      ? waitlistEntries.some(
          (w) => w.email.toLowerCase() === user.email.toLowerCase()
        )
      : false;

    const enrolWaitlist = (entry: Omit<WaitlistEntry, "id" | "createdAt">) => {
      setWaitlistEntries((prev) => {
        if (
          prev.some(
            (w) => w.email.toLowerCase() === entry.email.toLowerCase()
          )
        ) {
          return prev;
        }
        return [
          {
            id: uid("wl"),
            createdAt: new Date().toISOString(),
            ...entry,
          },
          ...prev,
        ];
      });
    };

    const applyReferralCredit = (refCode: string | undefined) => {
      const normalised = normalizeReferralCode(refCode ?? "");
      if (!normalised) return;
      let updatedReferrer: User | null = null;
      setCustomers((prev) =>
        prev.map((c) => {
          if (!c.referralCode) return c;
          if (c.referralCode.toUpperCase() !== normalised) return c;
          const next: User = {
            ...c,
            pendingCreditGHS:
              (c.pendingCreditGHS ?? 0) + REFERRAL_CREDIT_GHS,
            referralsCount: (c.referralsCount ?? 0) + 1,
          };
          updatedReferrer = next;
          return next;
        })
      );
      // Push the credit accrual to the shared Supabase customers
      // table so the referrer sees the credit on every device.
      if (updatedReferrer && getRole(updatedReferrer) === "customer") {
        void catalog.upsertCustomerRow(updatedReferrer).catch((err) => {
          console.warn(
            "[KAYA] Referral credit didn't reach the server:",
            err
          );
        });
      }
    };

    return {
      user,
      login: (data) => {
        const normalisedRef = data.referredByCode
          ? normalizeReferralCode(data.referredByCode)
          : undefined;
        const u: User = {
          id: uid("u"),
          role: "customer",
          joinedAt: new Date().toISOString(),
          referralCode: generateReferralCode(
            data.firstName || data.name || "K"
          ),
          pendingCreditGHS: 0,
          referralsCount: 0,
          ...data,
          referredByCode: normalisedRef || undefined,
        };
        setUserState(u);
        setCustomers((prev) => [u, ...prev.filter((x) => x.email !== u.email)]);
        // Push the new customer to the shared Supabase customers
        // table so they can sign in from any device and the admin
        // sees them in the global customer list within ~30s.
        void catalog.upsertCustomerRow(u).catch((err) => {
          console.warn(
            "[KAYA] Customer signup didn't reach the server:",
            err
          );
        });
        enrolWaitlist({
          name: u.name,
          email: u.email,
          phone: u.phone,
          source: "signup" as WaitlistSource,
          referredByCode: normalisedRef || undefined,
        });
        if (normalisedRef) applyReferralCredit(normalisedRef);
        return u;
      },
      signInAs: (u) => {
        setUserState(u);
        setCustomers((prev) =>
          prev.some((x) => x.id === u.id) ? prev : [u, ...prev]
        );
        // Mirror the active customer to the shared Supabase table
        // so any device-local edits made before this sign-in survive
        // a switch to a new browser.
        if (getRole(u) === "customer") {
          void catalog.upsertCustomerRow(u).catch((err) => {
            console.warn(
              "[KAYA] Customer record didn't reach the server:",
              err
            );
          });
        }
      },
      signInWithCredentials: (email, password) => {
        const cleanedEmail = email.trim().toLowerCase();
        const found = customers.find(
          (u) => u.email.toLowerCase() === cleanedEmail
        );
        if (!found) {
          return { ok: false, error: "No staff account found with that email." };
        }
        if (getRole(found) === "customer") {
          return {
            ok: false,
            error: "This sign-in is for staff only — customers sign in at /login.",
          };
        }
        if (!found.password || found.password !== password) {
          return { ok: false, error: "Wrong password. Try again." };
        }
        const updated: User = {
          ...found,
          lastSignInAt: new Date().toISOString(),
        };
        setUserState(updated);
        setCustomers((prev) =>
          prev.map((x) => (x.id === updated.id ? updated : x))
        );
        // Push the fresh sign-in timestamp to the shared staff table
        // so the Staff tab on every device shows when each operator
        // last touched KAYA Ops.
        void catalog.updateStaffLastSignIn(updated.id).catch((err) => {
          console.warn(
            "[KAYA] Staff sign-in timestamp didn't reach the server:",
            err
          );
        });
        appendAudit(updated, {
          category: "auth",
          action: "Signed in to KAYA Ops",
        });
        return { ok: true, user: updated };
      },
      logout: () => {
        const currentUser = user;
        if (currentUser && getRole(currentUser) !== "customer") {
          appendAudit(currentUser, {
            category: "auth",
            action: "Signed out of KAYA Ops",
          });
        }
        setUserState(null);
        setCart([]);
        setCartMessageState("");
        setCartBundleIdState(null);
        setActiveRecipientId(null);
        // Customers authenticate via Supabase Auth (Google OAuth or
        // email + password), so also drop that session. Staff auth is
        // app-layer only, so nothing to sign out of on the Supabase
        // side for them.
        if (currentUser && getRole(currentUser) === "customer") {
          void supabase.auth.signOut().catch((err) =>
            console.warn("[KAYA] Supabase sign out failed:", err)
          );
        }
      },
      setUser: (u) => {
        setUserState(u);
        setCustomers((prev) =>
          prev.some((x) => x.id === u.id)
            ? prev.map((x) => (x.id === u.id ? u : x))
            : [u, ...prev]
        );
        if (getRole(u) === "customer") {
          void catalog.upsertCustomerRow(u).catch((err) => {
            console.warn(
              "[KAYA] Customer update didn't reach the server:",
              err
            );
          });
        }
      },
      respondToReferralPrompt: (source) => {
        if (!user) return;
        const patch: Partial<User> = {
          referralPromptedAt: new Date().toISOString(),
        };
        if (source) patch.referralSource = source;
        const updated: User = { ...user, ...patch };
        setUserState(updated);
        setCustomers((prev) =>
          prev.map((x) => (x.id === user.id ? { ...x, ...patch } : x))
        );
        if (getRole(user) === "customer") {
          void catalog.upsertCustomerRow(updated).catch((err) => {
            console.warn(
              "[KAYA] Referral prompt response didn't reach the server:",
              err
            );
          });
        }
      },
      setUserSubstitutionPreference: (pref) => {
        if (!user) return;
        const updated: User = { ...user, substitutionPreference: pref };
        setUserState(updated);
        setCustomers((prev) =>
          prev.map((x) =>
            x.id === user.id ? { ...x, substitutionPreference: pref } : x
          )
        );
        if (getRole(user) === "customer") {
          void catalog.upsertCustomerRow(updated).catch((err) => {
            console.warn(
              "[KAYA] Substitution preference didn't reach the server:",
              err
            );
          });
        }
      },
      requestPasswordReset: async (email) => {
        const cleaned = email.trim().toLowerCase();
        if (!cleaned.includes("@") || !cleaned.includes(".")) {
          return { ok: false, error: "Enter a valid email address." };
        }
        const { error } = await supabase.auth.resetPasswordForEmail(cleaned, {
          redirectTo: `${window.location.origin}/staff-reset-password`,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
      completePasswordReset: async (newPassword) => {
        if (!newPassword || newPassword.length < 8) {
          return {
            ok: false,
            error: "Password must be at least 8 characters.",
          };
        }
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser?.email) {
          return {
            ok: false,
            error: "Reset session expired. Request a fresh link.",
          };
        }
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) return { ok: false, error: error.message };
        const email = authUser.email.toLowerCase();
        const target = customers.find(
          (c) => c.email.toLowerCase() === email
        );
        if (target) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === target.id ? { ...c, password: newPassword } : c
            )
          );
          appendAudit(target, {
            category: "auth",
            action: "Reset password via email link",
          });
        }
        // Drop the recovery session so they're forced to sign in fresh.
        await supabase.auth.signOut();
        return { ok: true };
      },
      customers,
      addStaffMember: (data) => {
        if (deny("staff.manage", "manage staff accounts")) {
          return { ok: false, error: "Access denied" };
        }
        const cleanedEmail = data.email.trim().toLowerCase();
        if (customers.some((c) => c.email.toLowerCase() === cleanedEmail)) {
          return { ok: false, error: "An account with that email already exists." };
        }
        if (!data.password || data.password.length < 8) {
          return { ok: false, error: "Password must be at least 8 characters." };
        }
        const fn = data.firstName.trim();
        const ln = data.lastName.trim();
        const newStaff: User = {
          id: uid("u"),
          role: data.role,
          isAdmin: true,
          firstName: fn,
          lastName: ln,
          name: `${fn} ${ln}`,
          email: cleanedEmail,
          phone: data.phone?.trim(),
          country: "USA",
          currency: "GHS",
          phoneVerified: true,
          joinedAt: new Date().toISOString(),
          password: data.password,
          referralCode: generateReferralCode(fn || "K"),
          pendingCreditGHS: 0,
          referralsCount: 0,
        };
        setCustomers((prev) => [newStaff, ...prev]);
        // Push the new staff member to the shared Supabase staff
        // table so every other browser picks them up on the next
        // poll / focus tick and they can sign in from any device.
        void catalog.upsertStaffRow(newStaff).catch((err) => {
          console.error("[KAYA] Staff create failed:", err);
          toast.error("Staff didn't save to the server. Refreshing\u2026");
          void catalog
            .fetchStaff()
            .then((s) =>
              setCustomers((prev) =>
                catalog.mergeStaffWithLocalCustomers(s, prev)
              )
            )
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "staff",
            action: `Added new ${data.role.replace("_", " ")} account`,
            target: { type: "user", id: newStaff.id, label: newStaff.name },
            notes: `Email: ${cleanedEmail}`,
          });
        }
        return { ok: true, user: newStaff };
      },
      removeStaffMember: (id) => {
        if (deny("staff.manage", "manage staff accounts")) return false;
        if (user?.id === id) {
          toast.error("You can't remove your own account.");
          return false;
        }
        const target = customers.find((c) => c.id === id);
        if (!target) return false;
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        // Push the deletion to the shared Supabase staff table.
        void catalog.deleteStaffRow(id).catch((err) => {
          console.error("[KAYA] Staff delete failed:", err);
          toast.error("Staff delete didn't reach the server. Refreshing\u2026");
          void catalog
            .fetchStaff()
            .then((s) =>
              setCustomers((prev) =>
                catalog.mergeStaffWithLocalCustomers(s, prev)
              )
            )
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "staff",
            action: `Removed ${getRole(target).replace("_", " ")} account`,
            target: { type: "user", id: target.id, label: target.name },
          });
        }
        return true;
      },
      resetStaffPassword: (id, newPassword) => {
        if (deny("staff.manage", "reset staff passwords")) return false;
        if (!newPassword || newPassword.length < 8) {
          toast.error("Password must be at least 8 characters.");
          return false;
        }
        const target = customers.find((c) => c.id === id);
        if (!target) return false;
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, password: newPassword } : c
          )
        );
        // Push the new password to the shared Supabase staff table
        // so the operator can sign in from any other device.
        const updatedStaff: User = { ...target, password: newPassword };
        void catalog.upsertStaffRow(updatedStaff).catch((err) => {
          console.error("[KAYA] Staff password reset failed:", err);
          toast.error(
            "Password reset didn't reach the server. Refreshing\u2026"
          );
          void catalog
            .fetchStaff()
            .then((s) =>
              setCustomers((prev) =>
                catalog.mergeStaffWithLocalCustomers(s, prev)
              )
            )
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "staff",
            action: "Reset password",
            target: { type: "user", id, label: target.name },
          });
        }
        return true;
      },
      updateStaffEmail: (id, newEmail) => {
        if (!can("staff.manage", user)) {
          if (user) {
            toast.error("Access denied \u2014 you can't manage staff accounts.");
            appendAudit(user, {
              category: "access",
              action: "Denied: update staff email",
              notes: "Missing permission: staff.manage",
            });
          }
          return { ok: false, error: "Access denied" };
        }
        const cleaned = newEmail.trim().toLowerCase();
        if (!cleaned.includes("@") || !cleaned.includes(".")) {
          return { ok: false, error: "Enter a valid email address." };
        }
        const targetUser = customers.find((c) => c.id === id);
        if (!targetUser)
          return { ok: false, error: "Staff member not found." };
        if (targetUser.email.toLowerCase() === cleaned) {
          return {
            ok: false,
            error: "This is already the current email.",
          };
        }
        const conflict = customers.find(
          (c) => c.id !== id && c.email.toLowerCase() === cleaned
        );
        if (conflict) {
          return {
            ok: false,
            error: `Email already used by ${conflict.name}.`,
          };
        }
        const oldEmail = targetUser.email;
        setCustomers((prev) =>
          prev.map((c) => (c.id === id ? { ...c, email: cleaned } : c))
        );
        if (user?.id === id) {
          setUserState((prev) =>
            prev ? { ...prev, email: cleaned } : prev
          );
        }
        // Push the new email to the shared Supabase staff table so
        // the operator can sign in with the updated address from
        // any other device.
        const updatedEmailStaff: User = { ...targetUser, email: cleaned };
        void catalog.upsertStaffRow(updatedEmailStaff).catch((err) => {
          console.error("[KAYA] Staff email update failed:", err);
          toast.error(
            "Email change didn't reach the server. Refreshing\u2026"
          );
          void catalog
            .fetchStaff()
            .then((s) =>
              setCustomers((prev) =>
                catalog.mergeStaffWithLocalCustomers(s, prev)
              )
            )
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "staff",
            action: "Updated sign-in email",
            target: { type: "user", id, label: targetUser.name },
            notes: `${oldEmail} \u2192 ${cleaned}`,
          });
        }
        return { ok: true };
      },
      // Recipients are owned per-user; scope the visible list to
      // the active customer so a customer never sees another
      // customer's loved ones, while staff (admin RecipientsTab,
      // ops support) get the global view for support and audit.
      recipients: !user
        ? []
        : getRole(user) === "customer"
        ? recipients.filter((r) => !r.userId || r.userId === user.id)
        : recipients,
      addRecipient: (r) => {
        const nr: Recipient = {
          id: uid("rcp"),
          createdAt: new Date().toISOString(),
          ...r,
          userId: user?.id,
        };
        setRecipients((prev) => [nr, ...prev]);
        // Push to shared Supabase recipients table so the customer
        // sees their saved loved ones from any device.
        if (user) {
          void catalog.upsertRecipientRow(user.id, nr).catch((err) => {
            console.warn(
              "[KAYA] Recipient didn't reach the server:",
              err
            );
          });
        }
        return nr;
      },
      updateRecipient: (id, patch) => {
        const target = recipients.find((r) => r.id === id);
        if (!target) return;
        const updated: Recipient = { ...target, ...patch };
        setRecipients((prev) =>
          prev.map((r) => (r.id === id ? updated : r))
        );
        const ownerId = updated.userId ?? user?.id;
        if (ownerId) {
          void catalog
            .upsertRecipientRow(ownerId, updated)
            .catch((err) => {
              console.warn(
                "[KAYA] Recipient update didn't reach the server:",
                err
              );
            });
        }
      },
      removeRecipient: (id) => {
        setRecipients((prev) => prev.filter((r) => r.id !== id));
        void catalog.deleteRecipientRow(id).catch((err) => {
          console.warn(
            "[KAYA] Recipient delete didn't reach the server:",
            err
          );
        });
      },
      cart,
      activeRecipientId,
      setActiveRecipient: setActiveRecipientId,
      addToCart: (productId, qty = 1) =>
        setCart((prev) => {
          const existing = prev.find((l) => l.productId === productId);
          if (existing)
            return prev.map((l) =>
              l.productId === productId
                ? { ...l, quantity: l.quantity + qty }
                : l
            );
          return [...prev, { productId, quantity: qty }];
        }),
      updateCartQty: (productId, qty) =>
        setCart((prev) =>
          qty <= 0
            ? prev.filter((l) => l.productId !== productId)
            : prev.map((l) =>
                l.productId === productId ? { ...l, quantity: qty } : l
              )
        ),
      removeFromCart: (productId) =>
        setCart((prev) => prev.filter((l) => l.productId !== productId)),
      clearCart: () => {
        setCart([]);
        setCartMessageState("");
        setCartBundleIdState(null);
      },
      cartMessage,
      setCartMessage: (m) => setCartMessageState(m),
      cartBundleId,
      setCartBundleId: (id) => setCartBundleIdState(id),
      shops,
      updateShop: (id, patch) => {
        if (!user) {
          toast.error("Sign in to perform this action.");
          return;
        }
        const target = shops.find((s) => s.id === id);
        if (!target) return;
        const allKeys = Object.keys(patch);
        if (allKeys.length === 0) return;

        // Filter the patch by what the current user has permission to
        // change. Pricing requires `pricing.edit`, image requires
        // `shops.upload_image`, and everything else (name, tagline,
        // description, emoji, accent, active) requires `shops.edit`.
        // Fields the user can't change are silently dropped (with a
        // friendly toast) rather than blocking the entire save — so
        // a Manager editing both name + price gets the name saved with
        // a "pricing skipped" note.
        const pricingKeys = new Set([
          "minOrderGHS",
          "deliveryFeeGHS",
          "slaHours",
        ]);
        const effectivePatch: Partial<Shop> = {};
        const blocked = new Set<string>();
        let touchedImage = false;
        let touchedPricing = false;
        let touchedDetails = false;

        for (const key of allKeys) {
          const value = (patch as Record<string, unknown>)[key];
          if (key === "image") {
            if (can("shops.upload_image", user)) {
              (effectivePatch as Record<string, unknown>)[key] = value;
              touchedImage = true;
            } else {
              blocked.add("image");
            }
          } else if (pricingKeys.has(key)) {
            if (can("pricing.edit", user)) {
              (effectivePatch as Record<string, unknown>)[key] = value;
              touchedPricing = true;
            } else {
              blocked.add("pricing");
            }
          } else {
            if (can("shops.edit", user)) {
              (effectivePatch as Record<string, unknown>)[key] = value;
              touchedDetails = true;
            } else {
              blocked.add("details");
            }
          }
        }

        const effectiveKeys = Object.keys(effectivePatch);
        if (effectiveKeys.length === 0) {
          toast.error(
            "Access denied — you can't change those shop settings."
          );
          appendAudit(user, {
            category: "access",
            action: "Denied: update shop",
            target: { type: "shop", id, label: target.name },
            notes: `Tried: ${allKeys.join(", ")}`,
          });
          return;
        }

        if (blocked.size > 0) {
          toast.message(
            `Some changes were skipped — only Super Admin can change ${Array.from(
              blocked
            ).join(", ")}.`
          );
        }

        setShops((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...effectivePatch } : s))
        );
        // Push updated shop to shared Supabase catalog.
        const updatedShop: Shop = { ...target, ...effectivePatch };
        void catalog.upsertShopRow(updatedShop).catch((err) => {
          console.error("[KAYA] Shop update failed:", err);
          toast.error("Shop update didn't reach the server. Refreshing\u2026");
          void catalog.fetchShops().then(setShops).catch(() => {});
        });

        const onlyImage =
          touchedImage && !touchedPricing && !touchedDetails;
        appendAudit(user, {
          category: onlyImage
            ? "shops"
            : touchedPricing
            ? "settings"
            : "shops",
          action: onlyImage
            ? "Updated shop photograph"
            : touchedPricing && touchedDetails
            ? "Updated shop settings & pricing"
            : touchedPricing
            ? "Updated shop pricing / fees"
            : "Updated shop settings",
          target: { type: "shop", id, label: target.name },
          notes: effectiveKeys.join(", "),
        });
      },
      addShop: (shop) => {
        if (deny("shops.create", "create new shops")) return;
        const cleaned: Shop = {
          ...shop,
          id: shop.id || uid("shop"),
          name: shop.name.trim(),
          tagline: shop.tagline.trim(),
          description: shop.description.trim(),
          emoji: shop.emoji.trim() || "\uD83D\uDED2",
        };
        if (!cleaned.name) {
          toast.error("Shop name is required.");
          return;
        }
        if (shops.some((s) => s.id === cleaned.id)) {
          toast.error("A shop with that ID already exists.");
          return;
        }
        setShops((prev) => [...prev, cleaned]);
        // Push to shared Supabase catalog — every other open browser
        // picks the new shop up on its next poll/focus tick (within
        // ~30s) without a page reload.
        void catalog.upsertShopRow(cleaned).catch((err) => {
          console.error("[KAYA] Shop create failed:", err);
          toast.error("Shop didn't save to the server. Refreshing\u2026");
          void catalog.fetchShops().then(setShops).catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "shops",
            action: "Created shop",
            target: { type: "shop", id: cleaned.id, label: cleaned.name },
            notes: `Min: ${formatGHS(cleaned.minOrderGHS)} \u00b7 Fee: ${formatGHS(
              cleaned.deliveryFeeGHS
            )} \u00b7 SLA: ${cleaned.slaHours}h`,
          });
          toast.success(`${cleaned.name} created`);
        }
      },
      deleteShop: (id) => {
        if (deny("shops.delete", "delete shops")) return;
        const target = shops.find((s) => s.id === id);
        if (!target) return;
        const linkedProducts = products.filter((p) => p.shopId === id).length;
        const linkedOrders = orders.filter((o) => o.shopId === id).length;
        if (linkedProducts > 0 || linkedOrders > 0) {
          toast.error(
            `Cannot delete ${target.name} \u2014 ${linkedProducts} product${
              linkedProducts === 1 ? "" : "s"
            } and ${linkedOrders} order${
              linkedOrders === 1 ? "" : "s"
            } still reference it. Reassign or deactivate first.`
          );
          return;
        }
        setShops((prev) => prev.filter((s) => s.id !== id));
        // Push delete to shared Supabase catalog.
        void catalog.deleteShopRow(id).catch((err) => {
          console.error("[KAYA] Shop delete failed:", err);
          toast.error("Shop delete didn't reach the server. Refreshing\u2026");
          void catalog.fetchShops().then(setShops).catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "shops",
            action: "Deleted shop",
            target: { type: "shop", id, label: target.name },
            notes: "No linked products or orders",
          });
          toast.success(`${target.name} deleted`);
        }
      },
      products,
      upsertProduct: (p) => {
        const existing = products.find((x) => x.id === p.id);
        if (!existing) {
          if (deny("products.create", "create new products")) return;
        } else {
          const pricingChanged =
            existing.vendorCost !== p.vendorCost ||
            existing.sellingPrice !== p.sellingPrice;
          if (pricingChanged) {
            if (deny("pricing.edit", "edit product pricing")) return;
          } else {
            if (deny("products.edit", "edit product details")) return;
          }
        }
        setProducts((prev) =>
          prev.some((x) => x.id === p.id)
            ? prev.map((x) => (x.id === p.id ? p : x))
            : [p, ...prev]
        );
        // Push to shared Supabase catalog.
        void catalog.upsertProductRow(p).catch((err) => {
          console.error("[KAYA] Product save failed:", err);
          toast.error("Product didn't save to the server. Refreshing\u2026");
          void catalog.fetchProducts().then(setProducts).catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "products",
            action: existing ? "Updated product" : "Created product",
            target: { type: "product", id: p.id, label: p.name },
          });
        }
      },
      deleteProduct: (id) => {
        if (deny("products.delete", "delete products")) return;
        const target = products.find((p) => p.id === id);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        // Push delete to shared Supabase catalog.
        void catalog.deleteProductRow(id).catch((err) => {
          console.error("[KAYA] Product delete failed:", err);
          toast.error("Product delete didn't reach the server. Refreshing\u2026");
          void catalog.fetchProducts().then(setProducts).catch(() => {});
        });
        if (user && target) {
          appendAudit(user, {
            category: "products",
            action: "Deleted product",
            target: { type: "product", id, label: target.name },
          });
        }
      },
      setProductAvailability: (id, availability) => {
        if (deny("products.availability", "change product availability"))
          return;
        const target = products.find((p) => p.id === id);
        if (!target) return;
        const previous: ProductAvailability =
          target.availability ?? (target.active ? "active" : "inactive");
        if (previous === availability) return;
        const updatedProduct: Product = {
          ...target,
          availability,
          active: availability === "active",
        };
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? updatedProduct : p))
        );
        // Push updated availability to shared Supabase catalog.
        void catalog.upsertProductRow(updatedProduct).catch((err) => {
          console.error("[KAYA] Product availability save failed:", err);
          toast.error("Availability change didn't reach the server. Refreshing\u2026");
          void catalog.fetchProducts().then(setProducts).catch(() => {});
        });
        if (user) {
          const labels: Record<ProductAvailability, string> = {
            active: "Active",
            temporarily_unavailable: "Temporarily Unavailable",
            inactive: "Inactive",
          };
          appendAudit(user, {
            category: "products",
            action: `Set availability → ${labels[availability]}`,
            target: { type: "product", id, label: target.name },
            notes: `Was: ${labels[previous]}`,
          });
          toast.success(`${target.name} → ${labels[availability]}`);
        }
      },
      vendors,
      upsertVendor: (v) => {
        const existing = vendors.find((x) => x.id === v.id);
        if (!existing) {
          if (deny("vendors.create", "add new vendors")) return;
        } else {
          if (deny("vendors.edit", "edit vendor details")) return;
        }
        setVendors((prev) =>
          prev.some((x) => x.id === v.id)
            ? prev.map((x) => (x.id === v.id ? v : x))
            : [v, ...prev]
        );
        // Push to shared Supabase catalog.
        void catalog.upsertVendorRow(v).catch((err) => {
          console.error("[KAYA] Vendor save failed:", err);
          toast.error("Vendor didn't save to the server. Refreshing\u2026");
          void catalog.fetchVendors().then(setVendors).catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "vendors",
            action: existing ? "Updated vendor" : "Created vendor",
            target: { type: "vendor", id: v.id, label: v.name },
          });
        }
      },
      deleteVendor: (id) => {
        if (deny("vendors.delete", "delete vendors")) return;
        const target = vendors.find((v) => v.id === id);
        setVendors((prev) => prev.filter((v) => v.id !== id));
        // Push delete to shared Supabase catalog.
        void catalog.deleteVendorRow(id).catch((err) => {
          console.error("[KAYA] Vendor delete failed:", err);
          toast.error("Vendor delete didn't reach the server. Refreshing\u2026");
          void catalog.fetchVendors().then(setVendors).catch(() => {});
        });
        if (user && target) {
          appendAudit(user, {
            category: "vendors",
            action: "Deleted vendor",
            target: { type: "vendor", id, label: target.name },
          });
        }
      },
      deliveryAreas,
      upsertDeliveryArea: (area) => {
        if (deny("delivery_areas.manage", "manage delivery areas")) return;
        const cleaned: DeliveryArea = {
          ...area,
          name: area.name.trim(),
          zoneLabel: area.zoneLabel?.trim() || undefined,
        };
        if (!cleaned.name) {
          toast.error("Town / Area name is required.");
          return;
        }
        const existing = deliveryAreas.find((a) => a.id === cleaned.id);
        // Block duplicates by (city, name).
        const dup = deliveryAreas.find(
          (a) =>
            a.id !== cleaned.id &&
            a.city === cleaned.city &&
            a.name.toLowerCase() === cleaned.name.toLowerCase()
        );
        if (dup) {
          toast.error(
            `${cleaned.name} already exists in ${cleaned.city}.`
          );
          return;
        }
        console.log(
          "[KAYA] upsertDeliveryArea start:",
          cleaned.id,
          cleaned.name,
          cleaned.city
        );
        // Optimistic update — row visible in UI immediately.
        setDeliveryAreas((prev) => {
          const next = prev.some((a) => a.id === cleaned.id)
            ? prev.map((a) => (a.id === cleaned.id ? cleaned : a))
            : [cleaned, ...prev];
          console.log(
            "[KAYA] Optimistic delivery areas set:",
            next.length,
            "rows, includes new:",
            next.some((a) => a.id === cleaned.id)
          );
          return next;
        });
        // Write + refetch + REPLACE state with fresh server truth.
        // Awaiting the write guarantees the subsequent fetch sees the
        // committed row. Direct replace (not merge) is safe here
        // because trackWrite() holds off the polling sync until
        // both the write AND the refetch have completed, so we're
        // not racing any other in-flight fetch.
        void (async () => {
          try {
            await catalog.upsertDeliveryAreaRow(cleaned);
            console.log(
              "[KAYA] Delivery area write committed:",
              cleaned.id
            );
            const fresh = await catalog.fetchDeliveryAreas();
            console.log(
              "[KAYA] Delivery areas refetched from DB:",
              fresh.length,
              "rows, includes new:",
              fresh.some((a) => a.id === cleaned.id)
            );
            // Merge to preserve any OTHER optimistic rows written
            // by concurrent operations, but the just-saved row is
            // guaranteed to be in `fresh` since we awaited the
            // commit before refetching.
            setDeliveryAreas((prev) => mergeById(fresh, prev));
          } catch (err) {
            const detail =
              (err &&
                ((err as Error).message ||
                  (err as { error_description?: string })
                    .error_description ||
                  (err as { hint?: string }).hint)) ||
              String(err);
            console.error(
              "[KAYA] Delivery area save failed:",
              err,
              detail
            );
            toast.error(`Delivery area save failed: ${detail}`);
            try {
              const fresh = await catalog.fetchDeliveryAreas();
              setDeliveryAreas((prev) => mergeById(fresh, prev));
            } catch {
              /* ignore refetch failure */
            }
          }
        })();
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: existing
              ? "Updated delivery area"
              : "Added delivery area",
            target: {
              type: "delivery_area",
              id: cleaned.id,
              label: cleaned.name,
            },
            notes: `${cleaned.city} \u00b7 ${
              cleaned.serviceable ? "serviceable" : "not serviceable"
            }${cleaned.active ? "" : " \u00b7 hidden"}${
              cleaned.zoneLabel ? ` \u00b7 ${cleaned.zoneLabel}` : ""
            }`,
          });
          toast.success(
            existing
              ? `${cleaned.name} updated`
              : `${cleaned.name} added to ${cleaned.city}`
          );
        }
      },
      removeDeliveryArea: (id) => {
        if (deny("delivery_areas.manage", "remove delivery areas")) return;
        const target = deliveryAreas.find((a) => a.id === id);
        if (!target) return;
        setDeliveryAreas((prev) => prev.filter((a) => a.id !== id));
        // Push delete to shared Supabase catalog, then refetch to
        // ensure state matches DB. On error, MERGE the refetched
        // server rows so we don't accidentally resurrect deletes
        // that DID commit while surfacing the actual Supabase
        // error to the operator.
        void (async () => {
          try {
            await catalog.deleteDeliveryAreaRow(id);
            const fresh = await catalog.fetchDeliveryAreas();
            setDeliveryAreas(fresh);
          } catch (err) {
            const detail =
              (err &&
                ((err as Error).message ||
                  (err as { error_description?: string })
                    .error_description ||
                  (err as { hint?: string }).hint)) ||
              String(err);
            console.error(
              "[KAYA] Delivery area delete failed:",
              err,
              detail
            );
            toast.error(`Delivery area delete failed: ${detail}`);
            try {
              const fresh = await catalog.fetchDeliveryAreas();
              setDeliveryAreas((prev) => mergeById(fresh, prev));
            } catch {
              /* ignore */
            }
          }
        })();
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: "Removed delivery area",
            target: {
              type: "delivery_area",
              id,
              label: target.name,
            },
            notes: `${target.city}`,
          });
          toast.success(`${target.name} removed`);
        }
      },
      carePackages,
      upsertCarePackage: (pkg) => {
        const existing = carePackages.find((x) => x.id === pkg.id);
        if (!existing) {
          if (deny("care_packages.create", "create care packages")) return;
        } else {
          if (deny("care_packages.edit", "edit care packages")) return;
        }
        const cleaned: CarePackage = {
          ...pkg,
          name: pkg.name.trim(),
          shortDescription: pkg.shortDescription.trim(),
          emoji: pkg.emoji.trim() || "\uD83C\uDF81",
          priceGHS: Math.max(0, Math.round(pkg.priceGHS)),
          deliveryFeeGHS: Math.max(0, Math.round(pkg.deliveryFeeGHS)),
          items: pkg.items.filter((i) => i.quantity > 0),
          badge: pkg.badge?.trim() || undefined,
          updatedAt: new Date().toISOString(),
        };
        if (!cleaned.name) {
          toast.error("Care package name is required.");
          return;
        }
        if (cleaned.items.length === 0) {
          toast.error("Add at least one product to the care package.");
          return;
        }
        if (
          cleaned.status === "scheduled" &&
          cleaned.availableFrom &&
          cleaned.availableUntil &&
          cleaned.availableUntil < cleaned.availableFrom
        ) {
          toast.error("Schedule end date must be after the start date.");
          return;
        }
        setCarePackages((prev) =>
          prev.some((x) => x.id === cleaned.id)
            ? prev.map((x) => (x.id === cleaned.id ? cleaned : x))
            : [cleaned, ...prev]
        );
        // Push to shared Supabase catalog.
        void catalog.upsertCarePackageRow(cleaned).catch((err) => {
          console.error("[KAYA] Care package save failed:", err);
          toast.error("Care package didn't save to the server. Refreshing\u2026");
          void catalog
            .fetchCarePackages()
            .then(setCarePackages)
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: existing
              ? "Updated care package"
              : "Created care package",
            target: {
              type: "care_package",
              id: cleaned.id,
              label: cleaned.name,
            },
            notes: `${cleaned.items.length} items · ${cleaned.category} · ${cleaned.status}${cleaned.featured ? " · featured" : ""}`,
          });
          toast.success(
            existing ? `${cleaned.name} updated` : `${cleaned.name} created`
          );
        }
      },
      duplicateCarePackage: (id) => {
        if (deny("care_packages.create", "duplicate care packages")) return;
        const source = carePackages.find((p) => p.id === id);
        if (!source) return;
        const copy: CarePackage = {
          ...source,
          id: uid("cp"),
          name: `${source.name} (Copy)`,
          status: "draft",
          featured: false,
          createdAt: new Date().toISOString(),
          updatedAt: undefined,
        };
        setCarePackages((prev) => [copy, ...prev]);
        // Push to shared Supabase catalog.
        void catalog.upsertCarePackageRow(copy).catch((err) => {
          console.error("[KAYA] Care package duplicate failed:", err);
          toast.error("Duplicate didn't save to the server. Refreshing\u2026");
          void catalog
            .fetchCarePackages()
            .then(setCarePackages)
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: "Duplicated care package",
            target: {
              type: "care_package",
              id: copy.id,
              label: copy.name,
            },
            notes: `Cloned from ${source.name}`,
          });
          toast.success(`Duplicated as "${copy.name}"`);
        }
      },
      deleteCarePackage: (id) => {
        if (deny("care_packages.delete", "delete care packages")) return;
        const target = carePackages.find((p) => p.id === id);
        if (!target) return;
        setCarePackages((prev) => prev.filter((p) => p.id !== id));
        // Push delete to shared Supabase catalog.
        void catalog.deleteCarePackageRow(id).catch((err) => {
          console.error("[KAYA] Care package delete failed:", err);
          toast.error("Care package delete didn't reach the server. Refreshing\u2026");
          void catalog
            .fetchCarePackages()
            .then(setCarePackages)
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: "Deleted care package",
            target: {
              type: "care_package",
              id,
              label: target.name,
            },
          });
          toast.success(`${target.name} deleted`);
        }
      },
      setCarePackageStatus: (id, status) => {
        if (deny("care_packages.edit", "change care package status")) return;
        const target = carePackages.find((p) => p.id === id);
        if (!target || target.status === status) return;
        const statusUpdated: CarePackage = {
          ...target,
          status,
          updatedAt: new Date().toISOString(),
        };
        setCarePackages((prev) =>
          prev.map((p) => (p.id === id ? statusUpdated : p))
        );
        // Push status change to shared Supabase catalog.
        void catalog.upsertCarePackageRow(statusUpdated).catch((err) => {
          console.error("[KAYA] Care package status save failed:", err);
          toast.error("Status change didn't reach the server. Refreshing\u2026");
          void catalog
            .fetchCarePackages()
            .then(setCarePackages)
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: `Care package → ${status}`,
            target: {
              type: "care_package",
              id,
              label: target.name,
            },
          });
          toast.success(`${target.name} → ${status}`);
        }
      },
      setCarePackageFeatured: (id, featured) => {
        if (deny("care_packages.edit", "feature care packages")) return;
        const target = carePackages.find((p) => p.id === id);
        if (!target || target.featured === featured) return;
        const featuredUpdated: CarePackage = {
          ...target,
          featured,
          updatedAt: new Date().toISOString(),
        };
        setCarePackages((prev) =>
          prev.map((p) => (p.id === id ? featuredUpdated : p))
        );
        // Push featured flag to shared Supabase catalog.
        void catalog.upsertCarePackageRow(featuredUpdated).catch((err) => {
          console.error("[KAYA] Care package featured save failed:", err);
          toast.error("Featured flag didn't save to the server. Refreshing\u2026");
          void catalog
            .fetchCarePackages()
            .then(setCarePackages)
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: featured
              ? "Featured care package"
              : "Unfeatured care package",
            target: {
              type: "care_package",
              id,
              label: target.name,
            },
          });
        }
      },
      deliveryScheduleConfig,
      updateDeliveryScheduleConfig: (patch) => {
        if (deny("settings.edit", "change the delivery schedule")) return;
        const cleaned: Partial<DeliveryScheduleConfig> = { ...patch };
        if (typeof cleaned.sameDayCutoffHour === "number") {
          cleaned.sameDayCutoffHour = Math.max(
            0,
            Math.min(23, Math.round(cleaned.sameDayCutoffHour))
          );
        }
        if (typeof cleaned.bookingHorizonDays === "number") {
          cleaned.bookingHorizonDays = Math.max(
            1,
            Math.min(60, Math.round(cleaned.bookingHorizonDays))
          );
        }
        if (cleaned.daysAvailable) {
          const days = Array.from(
            new Set(
              cleaned.daysAvailable
                .map((d) => Math.round(d))
                .filter((d) => d >= 0 && d <= 6)
            )
          ).sort();
          if (days.length === 0) {
            toast.error("Keep at least one delivery day.");
            return;
          }
          cleaned.daysAvailable = days;
        }
        setDeliveryScheduleConfig((prev) => ({ ...prev, ...cleaned }));
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: "Updated delivery schedule",
            notes: Object.keys(cleaned).join(", "),
          });
        }
      },
      upsertDeliveryWindow: (windowItem) => {
        if (deny("settings.edit", "manage delivery windows")) return;
        const startHour = Math.max(
          0,
          Math.min(23, Math.round(windowItem.startHour))
        );
        const endHour = Math.max(
          0,
          Math.min(24, Math.round(windowItem.endHour))
        );
        if (endHour <= startHour) {
          toast.error("Window end hour must be after the start hour.");
          return;
        }
        if (windowItem.capacity <= 0) {
          toast.error("Window capacity must be at least 1.");
          return;
        }
        const cleaned: DeliveryWindow = {
          ...windowItem,
          id: windowItem.id || uid("dw"),
          label: windowItem.label.trim(),
          rangeLabel: windowItem.rangeLabel.trim(),
          startHour,
          endHour,
          capacity: Math.max(1, Math.round(windowItem.capacity)),
        };
        if (!cleaned.label) {
          toast.error("Window label is required.");
          return;
        }
        const existing = deliveryScheduleConfig.windows.find(
          (w) => w.id === cleaned.id
        );
        setDeliveryScheduleConfig((prev) => ({
          ...prev,
          windows: prev.windows.some((w) => w.id === cleaned.id)
            ? prev.windows.map((w) =>
                w.id === cleaned.id ? cleaned : w
              )
            : [...prev.windows, cleaned],
        }));
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: existing
              ? "Updated delivery window"
              : "Added delivery window",
            target: {
              type: "delivery_window",
              id: cleaned.id,
              label: cleaned.label,
            },
            notes: `${
              cleaned.rangeLabel ||
              `${cleaned.startHour}:00\u2013${cleaned.endHour}:00`
            } \u00b7 capacity ${cleaned.capacity}${
              cleaned.active ? "" : " \u00b7 paused"
            }`,
          });
          toast.success(
            existing ? `${cleaned.label} updated` : `${cleaned.label} added`
          );
        }
      },
      removeDeliveryWindow: (id) => {
        if (deny("settings.edit", "remove delivery windows")) return;
        const target = deliveryScheduleConfig.windows.find(
          (w) => w.id === id
        );
        if (!target) return;
        if (deliveryScheduleConfig.windows.length <= 1) {
          toast.error("Keep at least one delivery window.");
          return;
        }
        setDeliveryScheduleConfig((prev) => ({
          ...prev,
          windows: prev.windows.filter((w) => w.id !== id),
        }));
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: "Removed delivery window",
            target: {
              type: "delivery_window",
              id,
              label: target.label,
            },
          });
          toast.success(`${target.label} removed`);
        }
      },
      orders,
      createOrder: (o) => {
        const now = new Date().toISOString();
        const paidAt = new Date(Date.now() + 200).toISOString();
        const newOrder: Order = {
          substitutionPreference: user?.substitutionPreference ?? "allow",
          ...o,
          id: uid("ord"),
          createdAt: now,
          status: "Paid",
          history: [
            { status: "Pending", at: now },
            { status: "Paid", at: paidAt },
          ],
        };
        setOrders((prev) => [newOrder, ...prev]);

        // Push the new order to the shared Supabase orders table so
        // KAYA Ops sees it on every device instantly (within the
        // next poll / focus tick) without a page reload.
        void catalog.upsertOrderRow(newOrder).catch((err) => {
          console.error("[KAYA] Order create failed:", err);
          toast.error("Order didn't save to the server. Refreshing\u2026");
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });

        // Auto-create a location confirmation for the recipient the
        // moment their order is paid, unless their profile already
        // carries a verified GPS pin. Ops can then WhatsApp / SMS the
        // link from the OrderDetail page without any extra clicks,
        // and the customer sees a "confirming location" status card
        // on their order right away.
        const alreadyHasLocation =
          typeof newOrder.recipient.latitude === "number" &&
          typeof newOrder.recipient.longitude === "number";
        if (!alreadyHasLocation) {
          const nowIso = new Date().toISOString();
          const locationConfirmation: LocationConfirmation = {
            id: uid("lc"),
            orderId: newOrder.id,
            recipientId: newOrder.recipient.id,
            recipientName: newOrder.recipient.fullName,
            recipientPhone: newOrder.recipient.phone,
            token: generateConfirmationToken(),
            status: "pending",
            requestCall: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          setLocationConfirmations((prev) => [
            locationConfirmation,
            ...prev,
          ]);
          void upsertLocationConfirmationRow(
            locationConfirmation
          ).catch((err) => {
            console.warn(
              "[KAYA] Location confirmation for new order didn't reach the server:",
              err
            );
          });
        }

        const recipientName = newOrder.recipient.fullName.split(" ")[0];
        pushNotification({
          userId: newOrder.senderId,
          type: "order_confirmed",
          title: "Order confirmed",
          description: `Care for ${recipientName} is locked in. We'll start preparing it now.`,
          link: `/orders/${newOrder.id}`,
          orderId: newOrder.id,
        });

        // Branded order-confirmation email — the customer's *first*
        // email reinforces the scheduled delivery date, window, range
        // and recipient-availability they picked at checkout. Mirrors
        // the substitution / refund pattern: non-blocking, degrades
        // gracefully when RESEND_API_KEY isn't configured.
        const orderCustomer = customers.find(
          (c) => c.id === newOrder.senderId
        );
        if (orderCustomer?.email) {
          const schedule = newOrder.deliverySchedule;
          void supabase.functions
            .invoke("send-order-confirmation", {
              body: {
                customerEmail: orderCustomer.email,
                customerName: orderCustomer.name || newOrder.senderName,
                orderNumber: newOrder.id.slice(-6).toUpperCase(),
                recipientName: newOrder.recipient.fullName,
                recipientCity:
                  newOrder.recipient.townArea ?? newOrder.recipient.city,
                totalAmount: newOrder.totalGHS,
                currencyCode: newOrder.senderCurrency,
                itemCount: newOrder.items.reduce(
                  (a, b) => a + b.quantity,
                  0
                ),
                itemSummary: newOrder.items.slice(0, 5).map((i) => ({
                  name: i.name,
                  quantity: i.quantity,
                })),
                scheduledDateLabel: schedule
                  ? formatScheduledDate(schedule.date)
                  : undefined,
                scheduledWindowLabel: schedule?.windowLabel,
                scheduledWindowRange: schedule?.windowRangeLabel,
                recipientAvailability: schedule?.recipientAvailable,
                specialInstructions: schedule?.specialInstructions,
                orderUrl: `${window.location.origin}/orders/${newOrder.id}`,
              },
            })
            .then(({ data, error: emailError }) => {
              if (emailError) {
                console.warn(
                  "Order confirmation email failed:",
                  emailError
                );
              } else if (
                data &&
                (data as { sent?: boolean }).sent === false
              ) {
                console.warn(
                  "Order confirmation skipped:",
                  (data as { reason?: string }).reason ?? "Email not sent"
                );
              }
            })
            .catch((e: unknown) =>
              console.warn("Order confirmation email exception:", e)
            );
        }

        return newOrder;
      },
      updateOrderStatus: (id, status) => {
        if (deny("orders.update_status", "update order statuses")) return;
        const existing = orders.find((o) => o.id === id);
        if (!existing) return;
        const at = new Date().toISOString();
        const patch: Partial<Order> = {
          status,
          history: [...existing.history, { status, at }],
        };
        if (status === "Delivered" && !existing.recipientConfirmRequestedAt) {
          patch.recipientConfirmRequestedAt = at;
        }
        const updatedOrder: Order = { ...existing, ...patch };
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? updatedOrder : o))
        );
        // Push the status change to the shared Supabase orders table.
        void catalog.upsertOrderRow(updatedOrder).catch((err) => {
          console.error("[KAYA] Order status save failed:", err);
          toast.error(
            "Order status didn't save to the server. Refreshing\u2026"
          );
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });

        if (existing.status !== status) {
          const cfg = statusNotification(existing, status);
          if (cfg) {
            pushNotification({
              userId: existing.senderId,
              type: cfg.type,
              title: cfg.title,
              description: cfg.description,
              link: `/orders/${id}`,
              orderId: id,
            });
          }
          if (user) {
            appendAudit(user, {
              category: "orders",
              action: `Order → ${status}`,
              target: {
                type: "order",
                id,
                label: `#${id.slice(-6).toUpperCase()}`,
              },
            });
          }
        }
      },
      assignVendor: (id, vendorId) => {
        if (deny("vendors.assign", "assign vendors to orders")) return;
        const existing = orders.find((o) => o.id === id);
        if (!existing) return;
        const at = new Date().toISOString();
        const willAdvance =
          existing.status === "Pending" || existing.status === "Paid";
        const updatedOrder: Order = {
          ...existing,
          vendorId,
          status: willAdvance ? "Assigned to Vendor" : existing.status,
          history: willAdvance
            ? [...existing.history, { status: "Assigned to Vendor", at }]
            : existing.history,
        };
        const advance = willAdvance;

        setOrders((prev) =>
          prev.map((o) => (o.id === id ? updatedOrder : o))
        );
        // Push the vendor assignment to the shared Supabase orders
        // table so every other open device sees the change.
        void catalog.upsertOrderRow(updatedOrder).catch((err) => {
          console.error("[KAYA] Order vendor assign failed:", err);
          toast.error(
            "Vendor assignment didn't save to the server. Refreshing\u2026"
          );
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });

        if (advance && existing) {
          const recipientName = existing.recipient.fullName.split(" ")[0];
          pushNotification({
            userId: existing.senderId,
            type: "vendor_assigned",
            title: "Order being prepared",
            description: `KAYA is preparing care for ${recipientName}.`,
            link: `/orders/${id}`,
            orderId: id,
          });
        }
        if (user) {
          const vendor = vendors.find((v) => v.id === vendorId);
          appendAudit(user, {
            category: "orders",
            action: `Assigned to ${vendor?.name ?? "vendor"}`,
            target: {
              type: "order",
              id,
              label: `#${id.slice(-6).toUpperCase()}`,
            },
          });
        }
      },
      setRecipientConfirm: (id, value) => {
        // Recipient confirmation — no admin permission gate (recipient action).
        const existing = orders.find((o) => o.id === id);
        if (!existing) return;
        const at = new Date().toISOString();
        const newStatus: OrderStatus =
          value === "yes" ? "Completed" : "Flagged for Investigation";
        const updatedOrder: Order = {
          ...existing,
          recipientConfirmed: value,
          recipientConfirmedAt: at,
          status: newStatus,
          history: [...existing.history, { status: newStatus, at }],
        };
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? updatedOrder : o))
        );
        // Push the recipient confirmation to the shared Supabase
        // orders table so KAYA Ops sees it on every device.
        void catalog.upsertOrderRow(updatedOrder).catch((err) => {
          console.error("[KAYA] Recipient confirmation save failed:", err);
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });

        if (existing) {
          const recipientName = existing.recipient.fullName.split(" ")[0];
          if (value === "yes") {
            pushNotification({
              userId: existing.senderId,
              type: "recipient_confirmed",
              title: `${recipientName} confirmed receipt`,
              description:
                "Your care made it home safely. Thank you for sending love today.",
              link: `/orders/${id}`,
              orderId: id,
            });
          } else {
            pushNotification({
              userId: existing.senderId,
              type: "delivery_issue",
              title: "Delivery issue reported",
              description: `${recipientName} said the order didn't arrive. KAYA will reach out shortly.`,
              link: `/orders/${id}`,
              orderId: id,
            });
          }
        }
      },
      setDeliveryPhoto: (id, url) => {
        if (deny("orders.upload_photo", "upload delivery photos")) return;
        const existing = orders.find((o) => o.id === id);
        if (!existing) return;
        const updatedOrder: Order = { ...existing, deliveryPhoto: url };
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? updatedOrder : o))
        );
        void catalog.upsertOrderRow(updatedOrder).catch((err) => {
          console.error("[KAYA] Delivery photo save failed:", err);
          toast.error(
            "Delivery photo didn't save to the server. Refreshing\u2026"
          );
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });
        if (user) {
          appendAudit(user, {
            category: "orders",
            action: url ? "Uploaded delivery photo" : "Cleared delivery photo",
            target: {
              type: "order",
              id,
              label: `#${id.slice(-6).toUpperCase()}`,
            },
          });
        }
      },
      cancelOrder: (id, reason, options) => {
        if (deny("orders.cancel", "cancel orders")) return;
        const target = orders.find((o) => o.id === id);
        if (!target) return;
        const notify = options?.notifyCustomer ?? true;
        const cancelAt = new Date().toISOString();
        const cancelledOrder: Order = {
          ...target,
          status: "Cancelled",
          cancellationReason: reason,
          history: [...target.history, { status: "Cancelled", at: cancelAt }],
        };
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? cancelledOrder : o))
        );
        // Push the cancellation to the shared Supabase orders table.
        void catalog.upsertOrderRow(cancelledOrder).catch((err) => {
          console.error("[KAYA] Order cancel save failed:", err);
          toast.error(
            "Cancellation didn't save to the server. Refreshing\u2026"
          );
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });
        if (notify) {
          const recipientName = target.recipient.fullName.split(" ")[0];
          pushNotification({
            userId: target.senderId,
            type: "payment_update",
            title: "Order cancelled",
            description: reason
              ? `Your order for ${recipientName} has been cancelled: ${reason}`
              : `Your order for ${recipientName} has been cancelled.`,
            link: `/orders/${id}`,
            orderId: id,
          });
        }
        if (user) {
          appendAudit(user, {
            category: "orders",
            action: "Cancelled order",
            target: {
              type: "order",
              id,
              label: `#${id.slice(-6).toUpperCase()}`,
            },
            notes: notify
              ? reason
              : reason
              ? `${reason} \u00b7 customer not notified`
              : "Customer not notified",
          });
        }
      },
      refundOrder: async (id, reason, options) => {
        if (deny("orders.refund", "issue refunds"))
          return { ok: false, error: "Access denied" };
        const target = orders.find((o) => o.id === id);
        if (!target) return { ok: false, error: "Order not found" };
        const alreadyRefunded = target.refundAmountGHS ?? 0;
        const remaining = Math.max(0, target.totalGHS - alreadyRefunded);
        const requested = options?.amountGHS;
        const refundAmountGHS = Math.max(
          0,
          Math.min(remaining, requested ?? remaining)
        );
        if (refundAmountGHS <= 0) {
          toast.error("Nothing left to refund on this order.");
          return { ok: false, error: "Nothing to refund" };
        }
        const notify = options?.notifyCustomer ?? true;
        const totalAfter = alreadyRefunded + refundAmountGHS;
        const isPartial = totalAfter < target.totalGHS;

        // 1. Real Stripe refund — only when the order carries a payment intent.
        let stripeRefundId: string | null = null;
        if (target.stripePaymentIntentId) {
          const proportion = refundAmountGHS / target.totalGHS;
          const refundForeignMinor = Math.max(
            1,
            Math.round(proportion * target.totalForeign * 100)
          );
          const { data: stripeData, error: stripeError } =
            await supabase.functions.invoke("process-refund", {
              body: {
                paymentIntentId: target.stripePaymentIntentId,
                amount: refundForeignMinor,
                currency: target.senderCurrency.toLowerCase(),
                reason: reason ?? "Issued by KAYA Ops",
                orderId: target.id,
              },
            });
          if (stripeError) {
            let errorMessage = stripeError.message ?? "Stripe refund failed";
            try {
              const ctx = (stripeError as unknown as {
                context?: { text?: () => Promise<string> };
              }).context;
              if (ctx?.text) {
                const text = await ctx.text();
                if (text) errorMessage = text;
              }
            } catch {
              // ignore
            }
            toast.error(`Stripe refund failed: ${errorMessage}`);
            if (user) {
              appendAudit(user, {
                category: "orders",
                action: "Refund failed (Stripe)",
                target: {
                  type: "order",
                  id,
                  label: `#${id.slice(-6).toUpperCase()}`,
                },
                notes: errorMessage,
              });
            }
            return { ok: false, error: errorMessage };
          }
          stripeRefundId =
            (stripeData as { refundId?: string } | null)?.refundId ?? null;
        }

        // 2. Update local order state.
        const cancellationReason = reason
          ? `Refunded${isPartial ? " (partial)" : ""}: ${reason}`
          : `Refunded${isPartial ? " (partial)" : ""} by Super Admin`;
        const refundLine = `${
          isPartial
            ? `[Refund] ${formatGHS(refundAmountGHS)} of ${formatGHS(
                target.totalGHS
              )}`
            : `[Refund] Full ${formatGHS(refundAmountGHS)}`
        }${reason ? ` \u2014 ${reason}` : ""}${
          stripeRefundId ? ` \u2014 Stripe: ${stripeRefundId}` : ""
        }`;
        const at = new Date().toISOString();
        const refundedOrder: Order = {
          ...target,
          status: "Cancelled",
          cancellationReason,
          refundAmountGHS: totalAfter,
          refundedAt: at,
          adminNote: target.adminNote
            ? `${target.adminNote}\n\n${refundLine}`
            : refundLine,
          history: [...target.history, { status: "Cancelled", at }],
        };
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? refundedOrder : o))
        );
        // Push the refund result to the shared Supabase orders table
        // so KAYA Ops sees the updated status / note on every device.
        void catalog.upsertOrderRow(refundedOrder).catch((err) => {
          console.error("[KAYA] Refund save failed:", err);
          toast.error(
            "Refund record didn't save to the server. Refreshing\u2026"
          );
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });

        // 3. Customer-facing comms — in-app notification + branded email.
        if (user && notify) {
          const recipientName = target.recipient.fullName.split(" ")[0];
          pushNotification({
            userId: target.senderId,
            type: "payment_update",
            title: isPartial
              ? "Partial refund processed"
              : "Refund processed",
            description: isPartial
              ? `${formatGHS(
                  refundAmountGHS
                )} of your order for ${recipientName} has been refunded. Funds should reach you within 5\u201310 business days.`
              : `Your order for ${recipientName} has been refunded (${formatGHS(
                  refundAmountGHS
                )}). Funds should reach you within 5\u201310 business days.`,
            link: `/orders/${id}`,
            orderId: id,
          });
          const customer = customers.find((c) => c.id === target.senderId);
          if (customer?.email) {
            void supabase.functions
              .invoke("send-refund-receipt", {
                body: {
                  customerEmail: customer.email,
                  customerName: customer.name || target.senderName,
                  orderNumber: id.slice(-6).toUpperCase(),
                  recipientName: target.recipient.fullName,
                  refundAmount: refundAmountGHS,
                  totalAmount: target.totalGHS,
                  reason,
                  isPartial,
                  orderUrl: `${window.location.origin}/orders/${id}`,
                  currencyCode: target.senderCurrency,
                  scheduledDateLabel: target.deliverySchedule
                    ? formatScheduledDate(target.deliverySchedule.date)
                    : undefined,
                  scheduledWindowLabel:
                    target.deliverySchedule?.windowLabel,
                  scheduledWindowRange:
                    target.deliverySchedule?.windowRangeLabel,
                  recipientAvailability:
                    target.deliverySchedule?.recipientAvailable,
                  specialInstructions:
                    target.deliverySchedule?.specialInstructions,
                },
              })
              .then(({ data, error: emailError }) => {
                if (emailError) {
                  console.warn("Refund receipt email failed:", emailError);
                } else if (
                  data &&
                  (data as { sent?: boolean }).sent === false
                ) {
                  console.warn(
                    "Refund receipt skipped:",
                    (data as { reason?: string }).reason ?? "Email not sent"
                  );
                }
              })
              .catch((e: unknown) =>
                console.warn("Refund receipt email exception:", e)
              );
          }
        }

        // 4. Audit log + success toast.
        if (user) {
          const stripeNote = stripeRefundId
            ? ` \u00b7 Stripe: ${stripeRefundId}`
            : target.stripePaymentIntentId
            ? ""
            : " \u00b7 local-only (no Stripe charge)";
          const customerNote = notify ? "" : " \u00b7 customer not notified";
          appendAudit(user, {
            category: "orders",
            action: isPartial
              ? `Issued partial refund (${formatGHS(
                  refundAmountGHS
                )} of ${formatGHS(target.totalGHS)})`
              : `Issued full refund (${formatGHS(refundAmountGHS)})`,
            target: {
              type: "order",
              id,
              label: `#${id.slice(-6).toUpperCase()}`,
            },
            notes: `${reason ?? "No reason supplied"}${stripeNote}${customerNote}`,
          });
          toast.success(
            `${
              isPartial ? "Partial refund" : "Refund"
            } processed for #${id.slice(-6).toUpperCase()}`
          );
        }

        return { ok: true };
      },
      recordSubstitution: (orderId, data) => {
        if (!can("orders.substitute", user)) {
          if (user) {
            toast.error("Access denied — you can't record substitutions.");
            appendAudit(user, {
              category: "access",
              action: "Denied: record substitution",
              notes: "Missing permission: orders.substitute",
            });
          } else {
            toast.error("Sign in to perform this action.");
          }
          return { ok: false, error: "Access denied" };
        }
        const target = orders.find((o) => o.id === orderId);
        if (!target) return { ok: false, error: "Order not found" };
        const originalItem = target.items.find(
          (i) => i.productId === data.originalProductId
        );
        if (!originalItem) return { ok: false, error: "Item not in order" };
        const originalProduct = products.find(
          (p) => p.id === data.originalProductId
        );
        const replacementProduct = data.replacementProductId
          ? products.find((p) => p.id === data.replacementProductId)
          : undefined;
        const isHighValue = originalProduct
          ? originalProduct.sellingPrice >= highValueThresholdGHS
          : false;
        const preferContact =
          target.substitutionPreference === "contact_first";
        const forceApproval = isHighValue || preferContact;
        const effective: SubstitutionAction =
          forceApproval && data.action === "substituted"
            ? "approval_pending"
            : data.action;
        if (effective === "substituted" && !replacementProduct) {
          return { ok: false, error: "Replacement product required" };
        }

        const subId = uid("sub");
        const at = new Date().toISOString();
        const substitution: SubstitutionRecord = {
          id: subId,
          at,
          actorId: user!.id,
          actorName: user!.name,
          action: effective,
          originalProductId: data.originalProductId,
          originalProductName: originalItem.name,
          originalQuantity: originalItem.quantity,
          replacementProductId: replacementProduct?.id,
          replacementProductName: replacementProduct?.name,
          replacementQuantity:
            data.replacementQuantity ?? originalItem.quantity,
          reason: data.reason,
          customerNotifiedAt: at,
        };

        let newItems: OrderItem[] = target.items;
        let nextStatus: OrderStatus = target.status;
        let needsAttentionPatch: Partial<Order> = {};

        if (effective === "substituted" && replacementProduct) {
          const newItem: OrderItem = {
            productId: replacementProduct.id,
            name: replacementProduct.name,
            quantity: data.replacementQuantity ?? originalItem.quantity,
            priceGHS: replacementProduct.sellingPrice,
            shopId: replacementProduct.shopId,
          };
          newItems = target.items.map((i) =>
            i.productId === data.originalProductId ? newItem : i
          );
        } else if (effective === "removed") {
          newItems = target.items.filter(
            (i) => i.productId !== data.originalProductId
          );
        } else if (effective === "approval_pending") {
          nextStatus = "Needs Attention";
          needsAttentionPatch = {
            needsAttentionReason: `${originalItem.name} unavailable: ${data.reason}`,
            needsAttentionAt: at,
            pendingSubstitutionId: subId,
          };
        }

        const newSubtotalGHS = newItems.reduce(
          (s, i) => s + i.priceGHS * i.quantity,
          0
        );
        const newTotalGHS = newSubtotalGHS + target.deliveryFeeGHS;
        const scale =
          target.totalGHS > 0 ? newTotalGHS / target.totalGHS : 1;
        const newTotalForeign = +(target.totalForeign * scale).toFixed(2);

        const substitutedOrder: Order = {
          ...target,
          items: newItems,
          subtotalGHS: newSubtotalGHS,
          totalGHS: newTotalGHS,
          totalForeign: newTotalForeign,
          substitutions: [...(target.substitutions ?? []), substitution],
          status: nextStatus,
          history:
            nextStatus !== target.status
              ? [...target.history, { status: nextStatus, at }]
              : target.history,
          ...needsAttentionPatch,
        };
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? substitutedOrder : o))
        );
        // Push the substitution to the shared Supabase orders table.
        void catalog.upsertOrderRow(substitutedOrder).catch((err) => {
          console.error("[KAYA] Substitution save failed:", err);
          toast.error(
            "Substitution didn't save to the server. Refreshing\u2026"
          );
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });

        const recipientName = target.recipient.fullName.split(" ")[0];
        if (effective === "substituted" && replacementProduct) {
          pushNotification({
            userId: target.senderId,
            type: "substitution_made",
            title: "Item substituted in your order",
            description: `${originalItem.name} was unavailable and was replaced with ${replacementProduct.name} based on your substitution preference.`,
            link: `/orders/${orderId}`,
            orderId,
          });
        } else if (effective === "removed") {
          pushNotification({
            userId: target.senderId,
            type: "item_removed",
            title: "Item removed from your order",
            description: `${originalItem.name} was unavailable and removed from ${recipientName}'s order. Totals have been updated.`,
            link: `/orders/${orderId}`,
            orderId,
          });
        } else {
          pushNotification({
            userId: target.senderId,
            type: "substitution_approval_needed",
            title: "We need your approval",
            description: replacementProduct
              ? `${originalItem.name} is unavailable for ${recipientName}'s order. We propose ${replacementProduct.name} — tap to review.`
              : `${originalItem.name} is unavailable for ${recipientName}'s order. Tap to review options.`,
            link: `/orders/${orderId}`,
            orderId,
          });
        }

        // Best-effort branded email — non-blocking. Degrades gracefully when
        // RESEND_API_KEY isn't configured on the edge function.
        const subEmailCustomer = customers.find(
          (c) => c.id === target.senderId
        );
        if (subEmailCustomer?.email) {
          void supabase.functions
            .invoke("send-substitution-receipt", {
              body: {
                customerEmail: subEmailCustomer.email,
                customerName: subEmailCustomer.name || target.senderName,
                orderNumber: orderId.slice(-6).toUpperCase(),
                recipientName: target.recipient.fullName,
                originalProductName: originalItem.name,
                originalQuantity: originalItem.quantity,
                replacementProductName: replacementProduct?.name,
                replacementQuantity:
                  data.replacementQuantity ?? originalItem.quantity,
                event: effective,
                reason: data.reason,
                orderUrl: `${window.location.origin}/orders/${orderId}`,
                scheduledDateLabel: target.deliverySchedule
                  ? formatScheduledDate(target.deliverySchedule.date)
                  : undefined,
                scheduledWindowLabel:
                  target.deliverySchedule?.windowLabel,
                scheduledWindowRange:
                  target.deliverySchedule?.windowRangeLabel,
                recipientAvailability:
                  target.deliverySchedule?.recipientAvailable,
                specialInstructions:
                  target.deliverySchedule?.specialInstructions,
              },
            })
            .then(({ data: emailData, error: emailError }) => {
              if (emailError) {
                console.warn("Substitution email failed:", emailError);
              } else if (
                emailData &&
                (emailData as { sent?: boolean }).sent === false
              ) {
                console.warn(
                  "Substitution email skipped:",
                  (emailData as { reason?: string }).reason ?? "Email not sent"
                );
              }
            })
            .catch((e: unknown) =>
              console.warn("Substitution email exception:", e)
            );
        }

        if (user) {
          appendAudit(user, {
            category: "orders",
            action:
              effective === "substituted"
                ? `Substituted ${originalItem.name} → ${replacementProduct?.name}`
                : effective === "removed"
                ? `Removed ${originalItem.name} from order`
                : `Flagged for approval: ${originalItem.name}`,
            target: {
              type: "order",
              id: orderId,
              label: `#${orderId.slice(-6).toUpperCase()}`,
            },
            notes: data.reason,
          });
          toast.success(
            effective === "substituted"
              ? "Substitution recorded"
              : effective === "removed"
              ? "Item removed from order"
              : "Customer approval requested"
          );
        }
        return { ok: true };
      },
      approveSubstitution: (orderId, substitutionId, approved) => {
        const target = orders.find((o) => o.id === orderId);
        if (!target) return;
        const sub = target.substitutions?.find((s) => s.id === substitutionId);
        if (!sub || sub.action !== "approval_pending") return;
        const at = new Date().toISOString();

        let newItems: OrderItem[] = target.items;
        if (approved && sub.replacementProductId) {
          const replacementProduct = products.find(
            (p) => p.id === sub.replacementProductId
          );
          if (replacementProduct) {
            const newItem: OrderItem = {
              productId: replacementProduct.id,
              name: replacementProduct.name,
              quantity: sub.replacementQuantity ?? sub.originalQuantity,
              priceGHS: replacementProduct.sellingPrice,
              shopId: replacementProduct.shopId,
            };
            newItems = target.items.map((i) =>
              i.productId === sub.originalProductId ? newItem : i
            );
          }
        } else {
          newItems = target.items.filter(
            (i) => i.productId !== sub.originalProductId
          );
        }

        const newSubtotalGHS = newItems.reduce(
          (s, i) => s + i.priceGHS * i.quantity,
          0
        );
        const newTotalGHS = newSubtotalGHS + target.deliveryFeeGHS;
        const scale =
          target.totalGHS > 0 ? newTotalGHS / target.totalGHS : 1;
        const newTotalForeign = +(target.totalForeign * scale).toFixed(2);

        const nextStatus: OrderStatus = "Being Prepared";
        const approvedSubstitutions = (target.substitutions ?? []).map((s) =>
          s.id === substitutionId
            ? {
                ...s,
                action: (approved ? "approved" : "rejected") as SubstitutionAction,
                resolvedAt: at,
              }
            : s
        );
        const approvedOrder: Order = {
          ...target,
          items: newItems,
          subtotalGHS: newSubtotalGHS,
          totalGHS: newTotalGHS,
          totalForeign: newTotalForeign,
          substitutions: approvedSubstitutions,
          status: nextStatus,
          needsAttentionReason: undefined,
          needsAttentionAt: undefined,
          pendingSubstitutionId: undefined,
          history: [...target.history, { status: nextStatus, at }],
        };
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? approvedOrder : o))
        );
        // Push the approval / rejection to the shared Supabase orders table.
        void catalog.upsertOrderRow(approvedOrder).catch((err) => {
          console.error("[KAYA] Substitution approval save failed:", err);
          toast.error(
            "Approval didn't save to the server. Refreshing\u2026"
          );
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });

        pushNotification({
          userId: target.senderId,
          type: "substitution_made",
          title: approved ? "Substitution approved" : "Substitution declined",
          description: approved
            ? sub.replacementProductName
              ? `${sub.originalProductName} was replaced with ${sub.replacementProductName}.`
              : `${sub.originalProductName} was removed from your order.`
            : `${sub.originalProductName} was removed from your order at your request.`,
          link: `/orders/${orderId}`,
          orderId,
        });

        // Fire-and-forget receipt — approved swap or removal both notify.
        const approveEmailCustomer = customers.find(
          (c) => c.id === target.senderId
        );
        if (approveEmailCustomer?.email) {
          void supabase.functions
            .invoke("send-substitution-receipt", {
              body: {
                customerEmail: approveEmailCustomer.email,
                customerName: approveEmailCustomer.name || target.senderName,
                orderNumber: orderId.slice(-6).toUpperCase(),
                recipientName: target.recipient.fullName,
                originalProductName: sub.originalProductName,
                originalQuantity: sub.originalQuantity,
                replacementProductName: approved
                  ? sub.replacementProductName
                  : undefined,
                replacementQuantity:
                  sub.replacementQuantity ?? sub.originalQuantity,
                event: approved ? "approved" : "rejected",
                orderUrl: `${window.location.origin}/orders/${orderId}`,
                scheduledDateLabel: target.deliverySchedule
                  ? formatScheduledDate(target.deliverySchedule.date)
                  : undefined,
                scheduledWindowLabel:
                  target.deliverySchedule?.windowLabel,
                scheduledWindowRange:
                  target.deliverySchedule?.windowRangeLabel,
                recipientAvailability:
                  target.deliverySchedule?.recipientAvailable,
                specialInstructions:
                  target.deliverySchedule?.specialInstructions,
              },
            })
            .then(({ error: emailError }) => {
              if (emailError) {
                console.warn("Substitution email failed:", emailError);
              }
            })
            .catch((e: unknown) =>
              console.warn("Substitution email exception:", e)
            );
        }

        if (user) {
          appendAudit(user, {
            category: "orders",
            action: approved
              ? "Customer approved substitution"
              : "Customer declined substitution",
            target: {
              type: "order",
              id: orderId,
              label: `#${orderId.slice(-6).toUpperCase()}`,
            },
            notes: `${sub.originalProductName} → ${
              sub.replacementProductName ?? "(removed)"
            }`,
          });
          toast.success(
            approved ? "Substitution applied" : "Item removed from order"
          );
        }
      },
      setAdminNote: (id, note) => {
        if (deny("orders.add_note", "add internal notes")) return;
        const existing = orders.find((o) => o.id === id);
        if (!existing) return;
        const updatedOrder: Order = { ...existing, adminNote: note };
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? updatedOrder : o))
        );
        void catalog.upsertOrderRow(updatedOrder).catch((err) => {
          console.error("[KAYA] Admin note save failed:", err);
          toast.error("Note didn't save to the server. Refreshing\u2026");
          void catalog
            .fetchOrders()
            .then((os) => setOrders(os.map(migrateOrder)))
            .catch(() => {});
        });
      },
      brandHeroUrl,
      setBrandHeroUrl: (url) => {
        if (deny("settings.edit", "edit platform settings")) return;
        setBrandHeroUrlState(url);
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: url
              ? "Updated login hero photograph"
              : "Reset login hero photograph",
          });
        }
      },
      highValueThresholdGHS,
      setHighValueThreshold: (amount) => {
        if (deny("settings.edit", "change platform settings")) return;
        const cleaned = Math.max(0, Math.round(amount));
        setHighValueThresholdState(cleaned);
        if (user) {
          appendAudit(user, {
            category: "settings",
            action: `Set high-value substitution threshold to ${formatGHS(
              cleaned
            )}`,
          });
        }
      },
      notifications: userNotifications,
      unreadCount,
      markNotificationRead: (id) =>
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        ),
      markAllNotificationsRead: () =>
        setNotifications((prev) =>
          prev.map((n) =>
            user && n.userId === user.id ? { ...n, read: true } : n
          )
        ),
      clearNotifications: () =>
        setNotifications((prev) =>
          user ? prev.filter((n) => n.userId !== user.id) : prev
        ),
      waitlistEntries,
      addWaitlistEntry: (entry) => {
        const existing = waitlistEntries.find(
          (w) => w.email.toLowerCase() === entry.email.toLowerCase()
        );
        if (existing) return null;
        const created: WaitlistEntry = {
          id: uid("wl"),
          createdAt: new Date().toISOString(),
          ...entry,
        };
        setWaitlistEntries((prev) => [created, ...prev]);
        return created;
      },
      isOnWaitlist,
      referralShares,
      recordReferralShare: (channel) => {
        if (!user?.referralCode) return;
        setReferralShares((prev) => [
          {
            id: uid("rs"),
            userId: user.id,
            referralCode: user.referralCode!,
            channel,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      },
      auditLog,
      recordAudit: (entry) => {
        if (!user) return;
        appendAudit(user, entry);
      },
      locationConfirmations,
      ensureLocationConfirmation: async (order) => {
        const hasVerified =
          typeof order.recipient.latitude === "number" &&
          typeof order.recipient.longitude === "number";
        if (hasVerified) return null;
        const existing = locationConfirmations.find(
          (c) => c.orderId === order.id
        );
        if (existing) return existing;
        const now = new Date().toISOString();
        const created: LocationConfirmation = {
          id: uid("lc"),
          orderId: order.id,
          recipientId: order.recipient.id,
          recipientName: order.recipient.fullName,
          recipientPhone: order.recipient.phone,
          token: generateConfirmationToken(),
          status: "pending",
          requestCall: false,
          createdAt: now,
          updatedAt: now,
        };
        setLocationConfirmations((prev) => [created, ...prev]);
        try {
          await upsertLocationConfirmationRow(created);
        } catch (err) {
          console.warn(
            "[KAYA] Location confirmation didn't reach the server:",
            err
          );
          toast.error(
            "Confirmation link didn't sync to the server. Try again."
          );
        }
        return created;
      },
      markLocationConfirmationNotified: (id) => {
        const target = locationConfirmations.find((c) => c.id === id);
        if (!target) return;
        const now = new Date().toISOString();
        const updated: LocationConfirmation = {
          ...target,
          notifiedAt: now,
          updatedAt: now,
        };
        setLocationConfirmations((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        );
        void upsertLocationConfirmationRow(updated).catch((err) =>
          console.warn(
            "[KAYA] Location confirmation notification save failed:",
            err
          )
        );
      },
      flagLocationConfirmationForFollowup: (id, note) => {
        const target = locationConfirmations.find((c) => c.id === id);
        if (!target) return;
        const now = new Date().toISOString();
        const updated: LocationConfirmation = {
          ...target,
          status: "needs_followup",
          followupNote: note?.trim() || undefined,
          updatedAt: now,
        };
        setLocationConfirmations((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        );
        void upsertLocationConfirmationRow(updated).catch((err) =>
          console.warn(
            "[KAYA] Location follow-up flag save failed:",
            err
          )
        );
        if (user) {
          appendAudit(user, {
            category: "orders",
            action: "Flagged recipient location for follow-up",
            target: {
              type: "order",
              id: target.orderId,
              label: `#${target.orderId.slice(-6).toUpperCase()}`,
            },
            notes: note?.trim(),
          });
        }
        toast.message(
          `Flagged for follow-up \u2014 ${target.recipientName}`
        );
      },
      resolveLocationConfirmationFollowup: (id) => {
        const target = locationConfirmations.find((c) => c.id === id);
        if (!target) return;
        const now = new Date().toISOString();
        const updated: LocationConfirmation = {
          ...target,
          status: "pending",
          followupNote: undefined,
          updatedAt: now,
        };
        setLocationConfirmations((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        );
        void upsertLocationConfirmationRow(updated).catch((err) =>
          console.warn(
            "[KAYA] Location follow-up resolution save failed:",
            err
          )
        );
        if (user) {
          appendAudit(user, {
            category: "orders",
            action: "Cleared recipient location follow-up flag",
            target: {
              type: "order",
              id: target.orderId,
              label: `#${target.orderId.slice(-6).toUpperCase()}`,
            },
          });
        }
        toast.success("Follow-up cleared");
      },
      signUpWithEmail: async (data) => {
        const cleanedEmail = data.email.trim().toLowerCase();
        const fn = data.firstName.trim();
        const ln = data.lastName.trim();
        const cleanedPhone = data.phone.trim();

        if (!fn || !ln) {
          return { ok: false, error: "First and last name are required." };
        }
        if (!cleanedEmail.includes("@") || !cleanedEmail.includes(".")) {
          return { ok: false, error: "Enter a valid email address." };
        }
        if (!data.password || data.password.length < 8) {
          return {
            ok: false,
            error: "Password must be at least 8 characters.",
          };
        }
        if (cleanedPhone.replace(/\D/g, "").length < 7) {
          return {
            ok: false,
            error:
              "Add a valid mobile number so we can send delivery updates.",
          };
        }
        const normalisedRef = data.referralCode
          ? normalizeReferralCode(data.referralCode)
          : undefined;

        const { data: authData, error: authError } =
          await supabase.auth.signUp({
            email: cleanedEmail,
            password: data.password,
            options: {
              emailRedirectTo: `${window.location.origin}/verify-email`,
              data: {
                first_name: fn,
                last_name: ln,
                full_name: `${fn} ${ln}`,
                phone: cleanedPhone,
                country: data.country,
              },
            },
          });

        if (authError) {
          const msg = authError.message ?? "Sign up failed.";
          const friendly = /registered|already/i.test(msg)
            ? "An account with this email already exists \u2014 sign in instead."
            : msg;
          return { ok: false, error: friendly };
        }
        if (!authData.user) {
          return { ok: false, error: "Sign up failed \u2014 try again." };
        }

        const fullName = `${fn} ${ln}`;
        const profile: User = {
          id: authData.user.id,
          role: "customer",
          firstName: fn,
          lastName: ln,
          name: fullName,
          email: cleanedEmail,
          phone: cleanedPhone,
          country: data.country,
          currency: "GHS",
          phoneVerified: true,
          joinedAt: new Date().toISOString(),
          lastSignInAt: new Date().toISOString(),
          referralCode: generateReferralCode(fn),
          referredByCode: normalisedRef || undefined,
          pendingCreditGHS: 0,
          referralsCount: 0,
        };

        try {
          await catalog.upsertCustomerRow(profile);
        } catch (err) {
          console.warn(
            "[KAYA] New customer profile didn't reach the server:",
            err
          );
        }

        // No Supabase session yet \u2014 email confirmation required.
        // The profile row is safely written; the user must confirm
        // via email before they can sign in.
        if (!authData.session) {
          return {
            ok: true,
            user: profile,
            needsEmailConfirmation: true,
          };
        }

        setUserState(profile);
        setCustomers((prev) => [
          profile,
          ...prev.filter((x) => x.email.toLowerCase() !== cleanedEmail),
        ]);

        enrolWaitlist({
          name: fullName,
          email: cleanedEmail,
          phone: cleanedPhone,
          source: "signup" as WaitlistSource,
          referredByCode: normalisedRef,
        });
        if (normalisedRef) applyReferralCredit(normalisedRef);

        return { ok: true, user: profile };
      },
      signInCustomerWithEmail: async (email, password) => {
        const cleanedEmail = email.trim().toLowerCase();
        if (!cleanedEmail.includes("@") || !cleanedEmail.includes(".")) {
          return { ok: false, error: "Enter a valid email address." };
        }
        if (!password) {
          return { ok: false, error: "Enter your password." };
        }

        const { data: authData, error: authError } =
          await supabase.auth.signInWithPassword({
            email: cleanedEmail,
            password,
          });

        if (authError) {
          const raw = authError.message ?? "Sign in failed.";
          const friendly = /invalid login credentials/i.test(raw)
            ? "Email or password is incorrect."
            : /email not confirmed/i.test(raw)
            ? "Please confirm your email address first \u2014 check your inbox."
            : raw;
          return { ok: false, error: friendly };
        }
        if (!authData.user) {
          return {
            ok: false,
            error: "Sign in didn't return a user \u2014 try again.",
          };
        }

        let profile = customers.find(
          (c) =>
            c.email.toLowerCase() === cleanedEmail &&
            getRole(c) === "customer"
        );
        if (!profile) {
          try {
            const list = await catalog.fetchCustomers();
            profile = list.find(
              (c) => c.email.toLowerCase() === cleanedEmail
            );
          } catch (err) {
            console.warn("[KAYA] Sign in fetch customers failed:", err);
          }
        }

        if (!profile) {
          const md = (authData.user.user_metadata ?? {}) as Record<
            string,
            string | undefined
          >;
          const firstName =
            md.first_name ||
            md.given_name ||
            (md.full_name || md.name || "").split(" ")[0] ||
            "";
          const lastName =
            md.last_name ||
            md.family_name ||
            (md.full_name || md.name || "")
              .split(" ")
              .slice(1)
              .join(" ") ||
            "";
          const fullName =
            md.full_name ||
            md.name ||
            `${firstName} ${lastName}`.trim() ||
            cleanedEmail.split("@")[0];
          profile = {
            id: authData.user.id,
            role: "customer",
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            name: fullName,
            email: cleanedEmail,
            phone: md.phone,
            country: (md.country as Country | undefined) ?? "USA",
            currency: "GHS",
            phoneVerified: !!md.phone,
            joinedAt: new Date().toISOString(),
            lastSignInAt: new Date().toISOString(),
            referralCode: generateReferralCode(
              firstName || fullName || "K"
            ),
            pendingCreditGHS: 0,
            referralsCount: 0,
          };
        } else {
          profile = { ...profile, lastSignInAt: new Date().toISOString() };
        }

        try {
          await catalog.upsertCustomerRow(profile);
        } catch (err) {
          console.warn("[KAYA] Sign in upsert customer failed:", err);
        }

        setUserState(profile);
        setCustomers((prev) => {
          const idx = prev.findIndex((c) => c.id === profile!.id);
          return idx === -1
            ? [
                profile!,
                ...prev.filter(
                  (c) => c.email.toLowerCase() !== cleanedEmail
                ),
              ]
            : prev.map((c, i) => (i === idx ? profile! : c));
        });
        return { ok: true, user: profile };
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
      requestCustomerPasswordReset: async (email) => {
        const cleaned = email.trim().toLowerCase();
        if (!cleaned.includes("@") || !cleaned.includes(".")) {
          return { ok: false, error: "Enter a valid email address." };
        }
        const { error } = await supabase.auth.resetPasswordForEmail(
          cleaned,
          {
            redirectTo: `${window.location.origin}/reset-password`,
          }
        );
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
      completeCustomerPasswordReset: async (newPassword) => {
        if (!newPassword || newPassword.length < 8) {
          return {
            ok: false,
            error: "Password must be at least 8 characters.",
          };
        }
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) return { ok: false, error: error.message };
        // Drop the recovery session so the user is forced to sign in
        // fresh with the new password.
        await supabase.auth.signOut();
        return { ok: true };
      },
      resendEmailVerification: async (email) => {
        const cleaned = email.trim().toLowerCase();
        if (!cleaned.includes("@") || !cleaned.includes(".")) {
          return { ok: false, error: "Enter a valid email address." };
        }
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: cleaned,
          options: {
            emailRedirectTo: `${window.location.origin}/verify-email`,
          },
        });
        if (error) {
          // Supabase surfaces rate-limit messages like
          // "For security purposes, you can only request this after
          // N seconds" here — pass them through so the UI can start
          // its own countdown and disable the resend button.
          return {
            ok: false,
            error:
              error.message ??
              "Couldn’t resend the verification email.",
          };
        }
        return { ok: true };
      },
    };
  }, [
    user,
    customers,
    recipients,
    cart,
    cartMessage,
    cartBundleId,
    activeRecipientId,
    shops,
    products,
    vendors,
    deliveryAreas,
    carePackages,
    deliveryScheduleConfig,
    orders,
    highValueThresholdGHS,
    brandHeroUrl,
    notifications,
    waitlistEntries,
    referralShares,
    auditLog,
    locationConfirmations,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
