import { supabase, trackWrite } from "@/lib/supabase";
import type {
  CarePackage,
  CarePackageCategory,
  CarePackageGiftOptions,
  CarePackageItem,
  CarePackageStatus,
  DeliveryArea,
  DeliverySchedule,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductAvailability,
  Recipient,
  Shop,
  SubstitutionPreference,
  SubstitutionRecord,
  User,
  UserRole,
  Vendor,
} from "@/types";

/**
 * ============================================================
 * Shared catalog data layer
 * ------------------------------------------------------------
 * Wraps every CRUD against the shared Supabase tables that back
 * the customer-facing catalogue:
 *
 *   - public.shops
 *   - public.vendors
 *   - public.products
 *   - public.delivery_areas
 *   - public.care_packages
 *
 * Both the Admin Portal and the Customer App read and write
 * through these helpers, so an edit made by an admin on one
 * device propagates to every other browser the moment a polling
 * cycle (~30s) or a window-focus event fires a refresh.
 *
 * Row mappers translate between the snake_case Postgres columns
 * and the camelCase TypeScript domain models the rest of the app
 * already uses, so callers never see raw rows.
 *
 * Security note: write policies are intentionally open to the
 * `anon` role today because staff authentication happens at the
 * application layer (password match against the seeded staff
 * record), not via Supabase Auth. Future hardening should
 * migrate staff sign-in to Supabase Auth and tighten the RLS
 * policies on these tables to authenticated-only.
 * ============================================================
 */

// ============================== SHOPS ==============================

interface ShopRow {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accent: string;
  image: string | null;
  min_order_ghs: number;
  delivery_fee_ghs: number;
  sla_hours: number;
  active: boolean;
}

const shopFromRow = (r: ShopRow): Shop => ({
  id: r.id,
  name: r.name,
  tagline: r.tagline ?? "",
  description: r.description ?? "",
  emoji: r.emoji ?? "",
  accent: r.accent ?? "bg-mustard-400 text-charcoal-900",
  image: r.image ?? undefined,
  minOrderGHS: r.min_order_ghs ?? 0,
  deliveryFeeGHS: r.delivery_fee_ghs ?? 0,
  slaHours: r.sla_hours ?? 24,
  active: r.active ?? true,
});

const shopToRow = (s: Shop): ShopRow => ({
  id: s.id,
  name: s.name,
  tagline: s.tagline,
  description: s.description,
  emoji: s.emoji,
  accent: s.accent,
  image: s.image && s.image.length > 0 ? s.image : null,
  min_order_ghs: s.minOrderGHS,
  delivery_fee_ghs: s.deliveryFeeGHS,
  sla_hours: s.slaHours,
  active: s.active,
});

export async function fetchShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ShopRow[]).map(shopFromRow);
}

export async function upsertShopRow(s: Shop): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("shops")
      .upsert(shopToRow(s), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteShopRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase.from("shops").delete().eq("id", id);
    if (error) throw error;
  });
}

// ============================= VENDORS =============================

interface VendorRow {
  id: string;
  name: string;
  contact: string;
  address: string | null;
  city: string | null;
  coverage_areas: string[];
  categories: string[];
  active: boolean;
}

const vendorFromRow = (r: VendorRow): Vendor => ({
  id: r.id,
  name: r.name,
  contact: r.contact ?? "",
  address: r.address ?? undefined,
  city: (r.city ?? undefined) as Vendor["city"],
  coverageAreas: (r.coverage_areas ?? []) as Vendor["coverageAreas"],
  categories: (r.categories ?? []) as Vendor["categories"],
  active: r.active ?? true,
});

const vendorToRow = (v: Vendor): VendorRow => ({
  id: v.id,
  name: v.name,
  contact: v.contact ?? "",
  address: v.address ?? null,
  city: (v.city as string | undefined) ?? null,
  coverage_areas: (v.coverageAreas ?? []) as string[],
  categories: (v.categories ?? []) as string[],
  active: v.active,
});

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as VendorRow[]).map(vendorFromRow);
}

export async function upsertVendorRow(v: Vendor): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("vendors")
      .upsert(vendorToRow(v), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteVendorRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) throw error;
  });
}

// ============================ PRODUCTS =============================

interface ProductRow {
  id: string;
  shop_id: string;
  vendor_id: string | null;
  vendor_ids: string[];
  name: string;
  image: string;
  unit: string;
  category: string;
  brand: string | null;
  description: string | null;
  sku: string | null;
  vendor_cost: number;
  selling_price: number;
  active: boolean;
  availability: string;
  warranty_months: number | null;
  delivery_class: string | null;
}

const productFromRow = (r: ProductRow): Product => {
  const vendorIds = (r.vendor_ids ?? []) as string[];
  const primaryVendor = r.vendor_id ?? vendorIds[0] ?? "";
  const availability = (r.availability ??
    (r.active ? "active" : "inactive")) as ProductAvailability;
  return {
    id: r.id,
    shopId: r.shop_id,
    vendorId: primaryVendor,
    vendorIds: vendorIds.length > 0 ? vendorIds : primaryVendor ? [primaryVendor] : [],
    name: r.name,
    image: r.image ?? "",
    unit: r.unit ?? "",
    category: r.category ?? "General",
    brand: r.brand ?? undefined,
    description: r.description ?? undefined,
    sku: r.sku ?? undefined,
    vendorCost: r.vendor_cost ?? 0,
    sellingPrice: r.selling_price ?? 0,
    active: availability === "active",
    availability,
    warrantyMonths: r.warranty_months ?? undefined,
    deliveryClass: r.delivery_class ?? undefined,
  };
};

const productToRow = (p: Product): ProductRow => {
  const vendorIds =
    p.vendorIds && p.vendorIds.length > 0
      ? p.vendorIds
      : p.vendorId
      ? [p.vendorId]
      : [];
  return {
    id: p.id,
    shop_id: p.shopId,
    vendor_id: p.vendorId && p.vendorId.length > 0 ? p.vendorId : null,
    vendor_ids: vendorIds,
    name: p.name,
    image: p.image ?? "",
    unit: p.unit ?? "",
    category: p.category ?? "General",
    brand: p.brand ?? null,
    description: p.description ?? null,
    sku: p.sku ?? null,
    vendor_cost: p.vendorCost ?? 0,
    selling_price: p.sellingPrice ?? 0,
    active: p.active,
    availability:
      p.availability ?? (p.active ? "active" : "inactive"),
    warranty_months: p.warrantyMonths ?? null,
    delivery_class: p.deliveryClass ?? null,
  };
};

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ProductRow[]).map(productFromRow);
}

export async function upsertProductRow(p: Product): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("products")
      .upsert(productToRow(p), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteProductRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  });
}

// ========================= DELIVERY AREAS ==========================

interface DeliveryAreaRow {
  id: string;
  name: string;
  city: string;
  region: string;
  zone_label: string | null;
  active: boolean;
  serviceable: boolean;
  created_at: string;
}

const deliveryAreaFromRow = (r: DeliveryAreaRow): DeliveryArea => ({
  id: r.id,
  name: r.name,
  city: r.city as DeliveryArea["city"],
  region: r.region,
  zoneLabel: r.zone_label ?? undefined,
  active: r.active ?? true,
  serviceable: r.serviceable ?? true,
  createdAt: r.created_at,
});

const deliveryAreaToRow = (a: DeliveryArea) => ({
  id: a.id,
  name: a.name,
  city: a.city,
  region: a.region,
  zone_label: a.zoneLabel ?? null,
  active: a.active,
  serviceable: a.serviceable,
  created_at: a.createdAt,
});

export async function fetchDeliveryAreas(): Promise<DeliveryArea[]> {
  const { data, error } = await supabase
    .from("delivery_areas")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as DeliveryAreaRow[]).map(deliveryAreaFromRow);
}

export async function upsertDeliveryAreaRow(a: DeliveryArea): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("delivery_areas")
      .upsert(deliveryAreaToRow(a), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteDeliveryAreaRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("delivery_areas")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
}

// ========================== CARE PACKAGES ==========================

interface CarePackageRow {
  id: string;
  name: string;
  short_description: string;
  cover_image: string | null;
  emoji: string;
  accent: string;
  category: string;
  price_ghs: number;
  delivery_fee_ghs: number;
  status: string;
  featured: boolean;
  items: CarePackageItem[] | null;
  available_from: string | null;
  available_until: string | null;
  availability_area_ids: string[] | null;
  gift_options: CarePackageGiftOptions | null;
  badge: string | null;
  created_at: string;
  updated_at: string | null;
}

const carePackageFromRow = (r: CarePackageRow): CarePackage => ({
  id: r.id,
  name: r.name,
  shortDescription: r.short_description ?? "",
  coverImage: r.cover_image ?? undefined,
  emoji: r.emoji ?? "",
  accent: r.accent ?? "bg-mustard-400 text-charcoal-900",
  category: (r.category ?? "other") as CarePackageCategory,
  priceGHS: r.price_ghs ?? 0,
  deliveryFeeGHS: r.delivery_fee_ghs ?? 0,
  status: (r.status ?? "draft") as CarePackageStatus,
  featured: r.featured ?? false,
  items: Array.isArray(r.items) ? r.items : [],
  availableFrom: r.available_from ?? undefined,
  availableUntil: r.available_until ?? undefined,
  availabilityAreaIds: r.availability_area_ids ?? undefined,
  giftOptions: r.gift_options ?? undefined,
  badge: r.badge ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined,
});

const carePackageToRow = (p: CarePackage) => ({
  id: p.id,
  name: p.name,
  short_description: p.shortDescription,
  cover_image: p.coverImage ?? null,
  emoji: p.emoji,
  accent: p.accent,
  category: p.category,
  price_ghs: p.priceGHS,
  delivery_fee_ghs: p.deliveryFeeGHS,
  status: p.status,
  featured: p.featured,
  items: p.items,
  available_from: p.availableFrom ?? null,
  available_until: p.availableUntil ?? null,
  availability_area_ids:
    p.availabilityAreaIds && p.availabilityAreaIds.length > 0
      ? p.availabilityAreaIds
      : null,
  gift_options: p.giftOptions ?? null,
  badge: p.badge ?? null,
});

export async function fetchCarePackages(): Promise<CarePackage[]> {
  const { data, error } = await supabase
    .from("care_packages")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CarePackageRow[]).map(carePackageFromRow);
}

export async function upsertCarePackageRow(p: CarePackage): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("care_packages")
      .upsert(carePackageToRow(p), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteCarePackageRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("care_packages")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
}

// ===================== COMBINED CATALOG FETCH ======================

export interface CatalogSnapshot {
  shops: Shop[];
  products: Product[];
  vendors: Vendor[];
  deliveryAreas: DeliveryArea[];
  carePackages: CarePackage[];
}

/**
 * Fetches every catalog entity in parallel. Uses Promise.allSettled
 * so a single failure (network hiccup on one endpoint, transient
 * Supabase blip, RLS misconfig on one table) never wipes the rest
 * — any entity that fails is returned as an empty array and its
 * error is logged. AppContext no longer calls this helper directly
 * (it fetches each entity independently for even finer-grained
 * resilience), but this remains available for any admin tool or
 * script that wants a one-shot snapshot without babysitting each
 * endpoint.
 */
export async function fetchCatalog(): Promise<CatalogSnapshot> {
  const [
    shopsRes,
    productsRes,
    vendorsRes,
    areasRes,
    cpRes,
  ] = await Promise.allSettled([
    fetchShops(),
    fetchProducts(),
    fetchVendors(),
    fetchDeliveryAreas(),
    fetchCarePackages(),
  ]);

  const unwrap = <T,>(
    res: PromiseSettledResult<T[]>,
    label: string
  ): T[] => {
    if (res.status === "fulfilled") return res.value;
    console.warn(`[KAYA] fetchCatalog ${label} failed:`, res.reason);
    return [];
  };

  return {
    shops: unwrap<Shop>(shopsRes, "shops"),
    products: unwrap<Product>(productsRes, "products"),
    vendors: unwrap<Vendor>(vendorsRes, "vendors"),
    deliveryAreas: unwrap<DeliveryArea>(areasRes, "delivery_areas"),
    carePackages: unwrap<CarePackage>(cpRes, "care_packages"),
  };
}

// ============================== ORDERS =============================
//
// Orders moved off per-browser localStorage to Supabase so the Admin
// Portal and customer app see the same pipeline across every device.
// Ops update an order on one tablet and the change appears on every
// customer / staff browser within ~30s (next poll/focus tick).

interface OrderRow {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_currency: string;
  recipient: Recipient;
  shop_id: string;
  bundle_id: string | null;
  items: OrderItem[];
  subtotal_ghs: number;
  delivery_fee_ghs: number;
  total_ghs: number;
  total_foreign: number;
  vendor_id: string | null;
  stripe_payment_intent_id: string | null;
  status: string;
  scheduled_for: string | null;
  delivery_schedule: DeliverySchedule | null;
  message: string | null;
  delivery_photo: string | null;
  recipient_confirmed: string | null;
  recipient_confirmed_at: string | null;
  recipient_confirm_requested_at: string | null;
  substitution_preference: string | null;
  substitutions: SubstitutionRecord[] | null;
  needs_attention_reason: string | null;
  needs_attention_at: string | null;
  pending_substitution_id: string | null;
  admin_note: string | null;
  cancellation_reason: string | null;
  refund_amount_ghs: number | null;
  refunded_at: string | null;
  history: Order["history"];
  created_at: string;
  updated_at: string;
}

const orderFromRow = (r: OrderRow): Order => ({
  id: r.id,
  senderId: r.sender_id,
  senderName: r.sender_name,
  senderCurrency: r.sender_currency as Order["senderCurrency"],
  recipient: r.recipient,
  shopId: r.shop_id,
  bundleId: r.bundle_id ?? undefined,
  items: Array.isArray(r.items) ? r.items : [],
  subtotalGHS: r.subtotal_ghs ?? 0,
  deliveryFeeGHS: r.delivery_fee_ghs ?? 0,
  totalGHS: r.total_ghs ?? 0,
  totalForeign: Number(r.total_foreign ?? 0),
  vendorId: r.vendor_id ?? undefined,
  stripePaymentIntentId: r.stripe_payment_intent_id ?? undefined,
  status: r.status as OrderStatus,
  createdAt: r.created_at,
  scheduledFor: r.scheduled_for ?? undefined,
  deliverySchedule: r.delivery_schedule ?? undefined,
  message: r.message ?? undefined,
  deliveryPhoto: r.delivery_photo ?? undefined,
  recipientConfirmed:
    (r.recipient_confirmed as Order["recipientConfirmed"]) ?? undefined,
  recipientConfirmedAt: r.recipient_confirmed_at ?? undefined,
  recipientConfirmRequestedAt:
    r.recipient_confirm_requested_at ?? undefined,
  substitutionPreference:
    (r.substitution_preference as SubstitutionPreference) ?? undefined,
  substitutions: r.substitutions ?? undefined,
  needsAttentionReason: r.needs_attention_reason ?? undefined,
  needsAttentionAt: r.needs_attention_at ?? undefined,
  pendingSubstitutionId: r.pending_substitution_id ?? undefined,
  adminNote: r.admin_note ?? undefined,
  cancellationReason: r.cancellation_reason ?? undefined,
  refundAmountGHS: r.refund_amount_ghs ?? undefined,
  refundedAt: r.refunded_at ?? undefined,
  history: Array.isArray(r.history) ? r.history : [],
});

const orderToRow = (o: Order) => ({
  id: o.id,
  sender_id: o.senderId,
  sender_name: o.senderName,
  sender_currency: o.senderCurrency,
  recipient: o.recipient,
  shop_id: o.shopId,
  bundle_id: o.bundleId ?? null,
  items: o.items,
  subtotal_ghs: o.subtotalGHS,
  delivery_fee_ghs: o.deliveryFeeGHS,
  total_ghs: o.totalGHS,
  total_foreign: o.totalForeign,
  vendor_id: o.vendorId ?? null,
  stripe_payment_intent_id: o.stripePaymentIntentId ?? null,
  status: o.status,
  scheduled_for: o.scheduledFor ?? null,
  delivery_schedule: o.deliverySchedule ?? null,
  message: o.message ?? null,
  delivery_photo: o.deliveryPhoto ?? null,
  recipient_confirmed: o.recipientConfirmed ?? null,
  recipient_confirmed_at: o.recipientConfirmedAt ?? null,
  recipient_confirm_requested_at: o.recipientConfirmRequestedAt ?? null,
  substitution_preference: o.substitutionPreference ?? null,
  substitutions: o.substitutions ?? null,
  needs_attention_reason: o.needsAttentionReason ?? null,
  needs_attention_at: o.needsAttentionAt ?? null,
  pending_substitution_id: o.pendingSubstitutionId ?? null,
  admin_note: o.adminNote ?? null,
  cancellation_reason: o.cancellationReason ?? null,
  refund_amount_ghs: o.refundAmountGHS ?? null,
  refunded_at: o.refundedAt ?? null,
  history: o.history,
  created_at: o.createdAt,
});

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as OrderRow[]).map(orderFromRow);
}

export async function upsertOrderRow(o: Order): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("orders")
      .upsert(orderToRow(o), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteOrderRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
  });
}

// =========================== STAFF MEMBERS =========================
//
// Staff / admin accounts moved off localStorage so adding a new
// staff member on one device makes them able to sign in immediately
// from any other device. Customer signups continue to live in
// localStorage on the device they signed up from (separate concern,
// not in scope for this migration).
//
// Security note: passwords are stored in plain text to match the
// existing application-layer auth model. Future hardening should
// migrate staff sign-in to Supabase Auth (auth.users) and tighten
// the table's RLS to authenticated reads only.

interface StaffRow {
  id: string;
  email: string;
  password: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  phone: string | null;
  role: string;
  is_admin: boolean;
  country: string | null;
  currency: string | null;
  phone_verified: boolean | null;
  joined_at: string | null;
  last_sign_in_at: string | null;
  referral_code: string | null;
  pending_credit_ghs: number | null;
  referrals_count: number | null;
}

const staffFromRow = (r: StaffRow): User => ({
  id: r.id,
  email: r.email,
  password: r.password,
  firstName: r.first_name ?? undefined,
  lastName: r.last_name ?? undefined,
  name: r.name,
  phone: r.phone ?? undefined,
  role: (r.role as UserRole) ?? "ops",
  isAdmin: r.is_admin ?? true,
  country: (r.country ?? "USA") as User["country"],
  currency: (r.currency ?? "GHS") as User["currency"],
  phoneVerified: r.phone_verified ?? true,
  joinedAt: r.joined_at ?? undefined,
  lastSignInAt: r.last_sign_in_at ?? undefined,
  referralCode: r.referral_code ?? undefined,
  pendingCreditGHS: r.pending_credit_ghs ?? 0,
  referralsCount: r.referrals_count ?? 0,
});

const staffToRow = (s: User): StaffRow => ({
  id: s.id,
  email: s.email,
  password: s.password ?? "",
  first_name: s.firstName ?? null,
  last_name: s.lastName ?? null,
  name: s.name,
  phone: s.phone ?? null,
  role: (s.role ?? "ops") as string,
  is_admin: s.isAdmin ?? true,
  country: s.country ?? null,
  currency: s.currency ?? null,
  phone_verified: s.phoneVerified ?? true,
  joined_at: s.joinedAt ?? null,
  last_sign_in_at: s.lastSignInAt ?? null,
  referral_code: s.referralCode ?? null,
  pending_credit_ghs: s.pendingCreditGHS ?? 0,
  referrals_count: s.referralsCount ?? 0,
});

export async function fetchStaff(): Promise<User[]> {
  const { data, error } = await supabase
    .from("staff_members")
    .select("*")
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data as StaffRow[]).map(staffFromRow);
}

export async function upsertStaffRow(s: User): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("staff_members")
      .upsert(staffToRow(s), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteStaffRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("staff_members")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
}

export async function updateStaffLastSignIn(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("staff_members")
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  });
}

/**
 * Merges a Supabase staff snapshot with the locally-stored customer
 * list so the `customers` array consumed by the UI always reflects
 * the shared staff source of truth plus this browser's customer
 * signups (which remain device-local).
 */
export function mergeStaffWithLocalCustomers(
  staff: User[],
  local: User[]
): User[] {
  const localOnlyCustomers = local.filter(
    (c) => (c.role ?? "customer") === "customer"
  );
  return [...staff, ...localOnlyCustomers];
}

// ============================ CUSTOMERS ============================
//
// Customer signups moved off device-local storage so a customer can
// sign in from any device and pick up their currency, referral
// credit and saved recipients. Admin Customers tab also sees the
// global signup list across every browser.
//
// Security note: customers don't have password sign-in today (they
// sign in by entering the email they signed up with), so no
// password column lives on this table. If we ever add customer
// passwords, gate the table behind Supabase Auth and hash credentials
// server-side.

interface CustomerRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  phone: string | null;
  country: string | null;
  currency: string | null;
  phone_verified: boolean | null;
  joined_at: string | null;
  last_sign_in_at: string | null;
  referral_code: string | null;
  referred_by_code: string | null;
  pending_credit_ghs: number | null;
  referrals_count: number | null;
  referral_prompted_at: string | null;
  referral_source: string | null;
  substitution_preference: string | null;
}

const customerFromRow = (r: CustomerRow): User => ({
  id: r.id,
  email: r.email,
  firstName: r.first_name ?? undefined,
  lastName: r.last_name ?? undefined,
  name: r.name,
  phone: r.phone ?? undefined,
  country: (r.country ?? "USA") as User["country"],
  currency: (r.currency ?? "USD") as User["currency"],
  phoneVerified: r.phone_verified ?? true,
  isAdmin: false,
  role: "customer",
  joinedAt: r.joined_at ?? undefined,
  lastSignInAt: r.last_sign_in_at ?? undefined,
  referralCode: r.referral_code ?? undefined,
  referredByCode: r.referred_by_code ?? undefined,
  pendingCreditGHS: r.pending_credit_ghs ?? 0,
  referralsCount: r.referrals_count ?? 0,
  referralPromptedAt: r.referral_prompted_at ?? undefined,
  referralSource:
    (r.referral_source as User["referralSource"] | null) ?? undefined,
  substitutionPreference:
    (r.substitution_preference as SubstitutionPreference | null) ??
    undefined,
});

const customerToRow = (c: User): CustomerRow => ({
  id: c.id,
  email: c.email,
  first_name: c.firstName ?? null,
  last_name: c.lastName ?? null,
  name: c.name,
  phone: c.phone ?? null,
  country: c.country ?? null,
  currency: c.currency ?? null,
  phone_verified: c.phoneVerified ?? true,
  joined_at: c.joinedAt ?? null,
  last_sign_in_at: c.lastSignInAt ?? null,
  referral_code: c.referralCode ?? null,
  referred_by_code: c.referredByCode ?? null,
  pending_credit_ghs: c.pendingCreditGHS ?? 0,
  referrals_count: c.referralsCount ?? 0,
  referral_prompted_at: c.referralPromptedAt ?? null,
  referral_source: c.referralSource ?? null,
  substitution_preference: c.substitutionPreference ?? null,
});

export async function fetchCustomers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return (data as CustomerRow[]).map(customerFromRow);
}

export async function upsertCustomerRow(c: User): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("customers")
      .upsert(customerToRow(c), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteCustomerRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  });
}

// =========================== RECIPIENTS ============================
//
// Saved loved ones (recipients) move off device-local storage so a
// customer can add a recipient from their laptop and ship to them
// from their phone five minutes later. Each row carries a user_id
// so AppContext can scope the customer-facing list to its rightful
// owner; admin / support staff get the global view in RecipientsTab.

interface RecipientRow {
  id: string;
  user_id: string;
  full_name: string;
  emoji: string;
  relationship: string | null;
  phone: string | null;
  address: string;
  city: string;
  region: string | null;
  town_area: string | null;
  landmark: string | null;
  notes: string | null;
  data:
    | {
        latitude?: number;
        longitude?: number;
        mapsLink?: string;
      }
    | null;
  created_at: string;
}

const recipientFromRow = (r: RecipientRow): Recipient => {
  const extras = r.data ?? {};
  return {
    id: r.id,
    userId: r.user_id,
    fullName: r.full_name,
    emoji: r.emoji ?? "",
    relationship: (r.relationship ??
      "Family Home") as Recipient["relationship"],
    phone: r.phone ?? "",
    address: r.address ?? "",
    city: (r.city ?? "Accra") as Recipient["city"],
    region: r.region ?? undefined,
    townArea: r.town_area ?? undefined,
    closestLandmark: r.landmark ?? undefined,
    deliveryNotes: r.notes ?? undefined,
    latitude: extras.latitude,
    longitude: extras.longitude,
    mapsLink: extras.mapsLink,
    createdAt: r.created_at,
  };
};

const recipientToRow = (userId: string, r: Recipient) => ({
  id: r.id,
  user_id: userId,
  full_name: r.fullName,
  emoji: r.emoji ?? "",
  relationship: r.relationship ?? null,
  phone: r.phone ?? null,
  address: r.address ?? "",
  city: r.city as string,
  region: r.region ?? null,
  town_area: r.townArea ?? null,
  landmark: r.closestLandmark ?? null,
  notes: r.deliveryNotes ?? null,
  data: {
    latitude: r.latitude,
    longitude: r.longitude,
    mapsLink: r.mapsLink,
  },
  created_at: r.createdAt,
});

export async function fetchRecipients(): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from("recipients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RecipientRow[]).map(recipientFromRow);
}

export async function fetchRecipientsForUser(
  userId: string
): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from("recipients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RecipientRow[]).map(recipientFromRow);
}

export async function upsertRecipientRow(
  userId: string,
  r: Recipient
): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("recipients")
      .upsert(recipientToRow(userId, r), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteRecipientRow(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase.from("recipients").delete().eq("id", id);
    if (error) throw error;
  });
}
