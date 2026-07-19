export type Country =
  | "USA"
  | "Canada"
  | "UK"
  | "Germany"
  | "UAE"
  | "France"
  | "Netherlands";

export type Currency = "USD" | "GBP" | "CAD" | "EUR" | "AED" | "GHS";

export type City = "Accra" | "Tema";

/**
 * Administrative region for delivery addresses. Only Greater Accra is
 * supported at launch (covers both Accra and Tema). Stored as `string`
 * on `Recipient` and `DeliveryArea` to allow ops to add more regions
 * post-launch without a code change.
 */
export type Region = "Greater Accra";

/**
 * Shop identifier. Originally a literal union for the four launch
 * shops (provision, mothercare, homegoods, gift) but widened to
 * `string` so admins can add custom shops via the Shops tab. The
 * four launch IDs above are still in use throughout the codebase.
 */
export type ShopId = string;

/**
 * Tri-state availability surfaced on product cards + ops controls.
 * `active` is purchasable; `temporarily_unavailable` is visible but
 * blocked from add-to-cart with a clear badge; `inactive` is hidden
 * from customers entirely.
 */
export type ProductAvailability =
  | "active"
  | "temporarily_unavailable"
  | "inactive";

export type Relationship =
  | "Mom"
  | "Dad"
  | "Grandma"
  | "Grandpa"
  | "Family Home"
  | "Student"
  | "Sibling"
  | "Friend"
  | "Spouse";

export type UserRole = "customer" | "ops" | "admin" | "super_admin";

export type ReferralSource =
  | "Friend or Family"
  | "WhatsApp Group"
  | "Facebook"
  | "Instagram"
  | "TikTok"
  | "Google Search"
  | "Community Organization / Church"
  | "Other";

/**
 * Customer preference for handling items that become unavailable
 * during fulfillment. Captured at checkout, remembered on the user
 * profile, surfaced to Ops in the Orders tab. Defaults to `allow`.
 */
export type SubstitutionPreference =
  | "allow"
  | "contact_first"
  | "remove";

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  country: Country;
  currency: Currency;
  phoneVerified?: boolean;
  isAdmin?: boolean;
  role?: UserRole;
  joinedAt?: string;
  /** Password — only used for staff portal sign-in (pre-launch local storage). */
  password?: string;
  /** Timestamp of last successful staff sign-in. */
  lastSignInAt?: string;
  referralSource?: ReferralSource;
  referralPromptedAt?: string;
  /** Unique invite code generated for this user — shown on the Profile referral card. */
  referralCode?: string;
  /** Code this user entered when signing up (if any). */
  referredByCode?: string;
  /** Pending GH₵ credit accrued from successful referrals. Applied at launch. */
  pendingCreditGHS?: number;
  /** Count of friends who signed up using this user's referral code. */
  referralsCount?: number;
  /** Default substitution preference applied to new orders. */
  substitutionPreference?: SubstitutionPreference;
  /**
   * Whether the customer has confirmed their email address via the
   * Supabase verification link / code. Customers can use KAYA before
   * verifying — an "Unverified" badge is shown on Profile and a
   * gentle banner prompts them to verify. Flipped to `true` the
   * moment the Supabase auth listener detects a live session for
   * this email (which only happens after the user opens the
   * verification link or enters the OTP code).
   */
  emailVerified?: boolean;
}

export interface BundleItem {
  productId: string;
  quantity: number;
}

export interface Bundle {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  shopId: ShopId;
  accent: string;
  image?: string;
  badge?: string;
  items: BundleItem[];
}

export interface Recipient {
  id: string;
  /**
   * The customer who owns this recipient. Set when persisted to the
   * shared Supabase recipients table; kept optional so historical
   * order snapshots (which embed a recipient at the time of purchase)
   * stay assignable from any caller without breaking older payloads.
   */
  userId?: string;
  fullName: string;
  phone: string;
  /** Free-text street address (house number, street, neighbourhood). */
  address: string;
  city: City;
  relationship: Relationship;
  emoji: string;
  createdAt: string;
  /** Administrative region. Defaults to "Greater Accra" at launch. */
  region?: string;
  /** Selected Town / Area from the editable Delivery Areas list. */
  townArea?: string;
  /** Strongly-encouraged landmark to help couriers locate the place. */
  closestLandmark?: string;
  /** Free-text delivery instructions (gate colour, security, leave-with). */
  deliveryNotes?: string;
  /** Optional Google Maps pin — latitude. */
  latitude?: number;
  /** Optional Google Maps pin — longitude. */
  longitude?: number;
  /** Shareable Google Maps URL generated from the pin coordinates. */
  mapsLink?: string;
}

/**
 * Customer answer to "Will someone be available to receive this
 * order?". Captured per-order during checkout and surfaced to ops on
 * the order detail page so drivers know whether to call ahead.
 */
export type RecipientAvailability = "available" | "contact_first";

/**
 * A single delivery time block (e.g. Morning 8 AM – 12 PM). Capacity
 * is the maximum number of orders that can be booked into this window
 * on a single day. When the count is reached the window auto-hides
 * from the customer date picker.
 */
export interface DeliveryWindow {
  id: string;
  /** Short display name surfaced on the customer-facing chip. */
  label: string;
  /** Pre-formatted human range, e.g. "8:00 AM \u2013 12:00 PM". */
  rangeLabel: string;
  /** Hour the window opens (0\u201323). */
  startHour: number;
  /** Hour the window closes (0\u201324). */
  endHour: number;
  /** When false the window is paused without losing the slot. */
  active: boolean;
  /** Maximum number of deliveries per day for this window. */
  capacity: number;
}

/**
 * Snapshot of the customer's delivery scheduling choice. Stored on the
 * Order so historical orders keep their labels even if Ops later edits
 * the source window definitions.
 */
export interface DeliverySchedule {
  /** ISO yyyy-mm-dd date for the scheduled delivery. */
  date: string;
  windowId: string;
  /** Snapshotted label \u2014 survives window edits / deletions. */
  windowLabel: string;
  /** Snapshotted human range, e.g. "8:00 AM \u2013 12:00 PM". */
  windowRangeLabel: string;
  recipientAvailable: RecipientAvailability;
  specialInstructions?: string;
}

/**
 * Super Admin\u2013managed platform configuration that drives the
 * date + window picker at checkout. Persisted in localStorage; the
 * default seed lives in lib/deliverySchedule.ts.
 */
export interface DeliveryScheduleConfig {
  windows: DeliveryWindow[];
  /** Hour (0\u201323) after which same-day delivery is no longer offered. */
  sameDayCutoffHour: number;
  /** Days of the week we deliver (0=Sun, 1=Mon, \u2026, 6=Sat). */
  daysAvailable: number[];
  /** How many days ahead customers can book. */
  bookingHorizonDays: number;
}

/**
 * Admin-editable delivery zone surfaced as the Town / Area dropdown on
 * the recipient form. Operations control which areas appear in the
 * dropdown (`active`) and whether KAYA actually delivers there
 * (`serviceable`). Non-serviceable areas trigger a waitlist prompt.
 */
export interface DeliveryArea {
  id: string;
  name: string;
  city: City;
  region: Region | string;
  /** Optional grouping label used by ops for routing & fee tiers. */
  zoneLabel?: string;
  /** When false, hidden from the customer dropdown. */
  active: boolean;
  /** When false, customer sees a waitlist prompt instead of saving. */
  serviceable: boolean;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  address?: string;
  city?: City;
  coverageAreas: City[];
  categories: ShopId[];
  active: boolean;
}

/**
 * Lifecycle state of a Care Package. `draft` is admin-editable but
 * hidden from customers; `scheduled` becomes customer-visible only
 * between `availableFrom` and `availableUntil`; `active` is always
 * purchasable.
 */
export type CarePackageStatus = "active" | "draft" | "scheduled";

/**
 * Themed category used by the admin filter row, customer browse
 * filter, and as a fallback for default emoji/accent when admins
 * don't supply their own.
 */
export type CarePackageCategory =
  | "new_baby"
  | "new_mother"
  | "birthday"
  | "get_well"
  | "housewarming"
  | "sympathy"
  | "student"
  | "holiday"
  | "essentials"
  | "other";

export interface CarePackageItem {
  productId: string;
  quantity: number;
}

export interface CarePackageGiftOptions {
  allowGiftWrap: boolean;
  giftWrapFeeGHS?: number;
  allowGreetingCard: boolean;
  allowPersonalMessage: boolean;
}

/**
 * KAYA's signature curated gift — a first-class admin-managed entity
 * that bundles products from any number of shops into a single
 * thoughtful package. Replaces the legacy hard-coded `Bundle` concept.
 */
export interface CarePackage {
  id: string;
  name: string;
  shortDescription: string;
  coverImage?: string;
  emoji: string;
  accent: string;
  category: CarePackageCategory;
  /** Customer-facing price. Auto-suggested as items × sellingPrice in
   * the admin editor; admin may override (e.g. for bundle discounts). */
  priceGHS: number;
  /** Configurable per-package delivery fee — since fulfillment may
   * require coordinating products from multiple shops. */
  deliveryFeeGHS: number;
  status: CarePackageStatus;
  featured: boolean;
  items: CarePackageItem[];
  /** ISO yyyy-mm-dd — first day the package is visible (status=scheduled). */
  availableFrom?: string;
  /** ISO yyyy-mm-dd — last day the package is visible (status=scheduled). */
  availableUntil?: string;
  /** Restrict fulfillment to specific delivery areas. Empty / undefined
   * means available in every serviceable area. */
  availabilityAreaIds?: string[];
  giftOptions?: CarePackageGiftOptions;
  badge?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Shop {
  id: ShopId;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accent: string;
  /** Optional photograph rendered on the shop card. Uploaded by admins. */
  image?: string;
  minOrderGHS: number;
  deliveryFeeGHS: number;
  slaHours: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  shopId: ShopId;
  /**
   * Primary vendor — legacy single-vendor field, retained for
   * back-compat with older code paths. New code reads from
   * `vendorIds`; this stays synced to `vendorIds[0]` whenever a
   * product is saved via the admin UI or bulk Excel import.
   */
  vendorId: string;
  /**
   * All vendors that can supply this product. Ops can pick any of
   * these when assigning the order downstream. Auto-populated from
   * `vendorId` on load by AppContext when missing (legacy migration).
   */
  vendorIds?: string[];
  vendorCost: number; // GHS
  sellingPrice: number; // GHS
  unit: string;
  category: string;
  image: string;
  active: boolean;
  description?: string;
  /** Manufacturer warranty in months — surfaced on Home Goods appliances. */
  warrantyMonths?: number;
  /** Tri-state availability — replaces legacy `active` boolean over time. */
  availability?: ProductAvailability;
  /** Manufacturer brand (e.g. Pampers, Philips). Surfaced on detail views. */
  brand?: string;
  /** Internal stock-keeping unit identifier. */
  sku?: string;
  /** Free-text routing class (e.g. standard, bulky, cold-chain). */
  deliveryClass?: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export type OrderStatus =
  | "Pending"
  | "Paid"
  | "Assigned to Vendor"
  | "Being Prepared"
  | "Out for Delivery"
  | "Delivered"
  | "Completed"
  | "Flagged for Investigation"
  | "Needs Attention"
  | "Cancelled";

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  priceGHS: number;
  shopId: ShopId;
}

/**
 * Outcome of an Ops substitution decision. `approval_pending` means the
 * customer must confirm before any item is actually changed.
 */
export type SubstitutionAction =
  | "substituted"
  | "removed"
  | "approval_pending"
  | "approved"
  | "rejected";

export interface SubstitutionRecord {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: SubstitutionAction;
  originalProductId: string;
  originalProductName: string;
  originalQuantity: number;
  replacementProductId?: string;
  replacementProductName?: string;
  replacementQuantity?: number;
  reason: string;
  customerNotifiedAt?: string;
  resolvedAt?: string;
}

export interface Order {
  id: string;
  senderId: string;
  senderName: string;
  senderCurrency: Currency;
  recipient: Recipient;
  shopId: ShopId;
  bundleId?: string;
  items: OrderItem[];
  subtotalGHS: number;
  deliveryFeeGHS: number;
  totalGHS: number;
  totalForeign: number;
  vendorId?: string;
  /** Stripe PaymentIntent ID — required for processing real Stripe refunds. */
  stripePaymentIntentId?: string;
  status: OrderStatus;
  createdAt: string;
  scheduledFor?: string;
  /**
   * Structured delivery window selected by the customer at checkout.
   * Used for ops routing, surfaced on the order detail page, and
   * counted against per-window daily capacity.
   */
  deliverySchedule?: DeliverySchedule;
  message?: string;
  deliveryPhoto?: string;
  recipientConfirmed?: "yes" | "no";
  recipientConfirmedAt?: string;
  recipientConfirmRequestedAt?: string;
  /** Customer's preference for handling unavailable items at order time. */
  substitutionPreference?: SubstitutionPreference;
  /** Substitution / removal records appended by Ops. */
  substitutions?: SubstitutionRecord[];
  /** Reason the order is currently flagged as Needs Attention. */
  needsAttentionReason?: string;
  /** ISO timestamp when the order was flagged Needs Attention. */
  needsAttentionAt?: string;
  /** Substitution awaiting customer approval — drives the Needs Attention banner. */
  pendingSubstitutionId?: string;
  adminNote?: string;
  cancellationReason?: string;
  /** Amount refunded in GHS (full or partial). Set by refundOrder. */
  refundAmountGHS?: number;
  /** ISO timestamp when the most recent refund was processed. */
  refundedAt?: string;
  history: { status: OrderStatus; at: string; by?: string }[];
}

export type NotificationType =
  | "order_confirmed"
  | "vendor_assigned"
  | "out_for_delivery"
  | "delivered"
  | "recipient_confirmed"
  | "delivery_issue"
  | "payment_update"
  | "promotion"
  | "substitution_made"
  | "substitution_approval_needed"
  | "item_removed";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  description: string;
  link?: string;
  orderId?: string;
  read: boolean;
  createdAt: string;
}

export type WaitlistSource = "signup" | "waitlist_page" | "checkout";

export interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: City | "Both";
  source: WaitlistSource;
  referredByCode?: string;
  createdAt: string;
}

/**
 * Channels we track for refer-a-friend analytics. Recorded the moment a
 * customer interacts with the Profile referral card so the admin can see
 * which share method is converting best.
 */
export type ReferralShareChannel =
  | "share_api"
  | "clipboard"
  | "code_copy"
  | "share_cancelled";

export interface ReferralShareEvent {
  id: string;
  userId: string;
  referralCode: string;
  channel: ReferralShareChannel;
  createdAt: string;
}

/**
 * Categories surfaced in the admin Audit Log tab. `access` is reserved
 * for denied-permission attempts so super admins can see attempted
 * unauthorized actions.
 */
export type AuditLogCategory =
  | "auth"
  | "shops"
  | "products"
  | "vendors"
  | "orders"
  | "waitlist"
  | "settings"
  | "staff"
  | "investigations"
  | "access";

/**
 * Sensitive admin action recorded with actor, role, timestamp, target
 * and optional notes. Visible only to Super Admin via the Audit Log tab.
 */
export interface AuditLogEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  category: AuditLogCategory;
  action: string;
  target?: { type: string; id: string; label: string };
  notes?: string;
}

/**
 * Verification status of a recipient's exact delivery location.
 *   pending          → link created, waiting for recipient submission
 *   verified         → recipient submitted GPS / landmark / directions
 *   needs_followup   → ops flagged the confirmation; sender is unreachable
 *                       or an initial attempt failed
 */
export type LocationVerificationStatus =
  | "pending"
  | "verified"
  | "needs_followup";

/**
 * One outstanding "please pin your exact delivery location" request
 * sent to a recipient after an order was placed. Backed by the shared
 * public.location_confirmations Supabase table so a request created on
 * an ops tablet is visible on every device within one polling cycle.
 *
 * The `token` field is the URL-safe secret embedded in the WhatsApp /
 * SMS link — recipients open `/confirm-location/:token` on their phone
 * without needing to sign in.
 */
export interface LocationConfirmation {
  id: string;
  orderId: string;
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
  /** URL-safe random token used in the confirmation link. */
  token: string;
  status: LocationVerificationStatus;
  latitude?: number;
  longitude?: number;
  /** Google Maps preview URL — generated from lat/lng on submission. */
  mapLink?: string;
  landmark?: string;
  writtenDirections?: string;
  /** Recipient asked for a KAYA team member to phone them for help. */
  requestCall: boolean;
  /** ISO timestamp the recipient submitted their location. */
  confirmedAt?: string;
  /** ISO timestamp of the most recent WhatsApp / SMS send attempt. */
  notifiedAt?: string;
  /** Free-text note captured by ops when flagging for follow-up. */
  followupNote?: string;
  createdAt: string;
  updatedAt: string;
}
