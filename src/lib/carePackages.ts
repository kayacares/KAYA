import type {
  CarePackage,
  CarePackageCategory,
  CarePackageStatus,
  DeliveryArea,
  Product,
  Recipient,
} from "@/types";

export interface CategoryMeta {
  id: CarePackageCategory;
  label: string;
  emoji: string;
  accent: string;
  description: string;
}

/**
 * Master catalogue of Care Package categories. Drives the admin
 * filter row, customer browse filter, and falls back to providing
 * emoji + accent for packages that don't override their own.
 */
export const CARE_PACKAGE_CATEGORIES: CategoryMeta[] = [
  {
    id: "new_baby",
    label: "New Baby",
    emoji: "\uD83D\uDC76",
    accent: "bg-sage-300 text-charcoal-900",
    description: "Diapers, formula, wipes and newborn essentials.",
  },
  {
    id: "new_mother",
    label: "New Mother",
    emoji: "\uD83E\uDD31",
    accent: "bg-clay-400 text-cream-50",
    description: "Postpartum care, comfort foods and pampering.",
  },
  {
    id: "birthday",
    label: "Birthday",
    emoji: "\uD83C\uDF82",
    accent: "bg-mustard-400 text-charcoal-900",
    description: "Cake, flowers, and a thoughtful birthday surprise.",
  },
  {
    id: "get_well",
    label: "Get Well Soon",
    emoji: "\uD83C\uDF37",
    accent: "bg-sage-100 text-sage-700",
    description: "Soothing treats, flowers and comfort.",
  },
  {
    id: "housewarming",
    label: "Housewarming",
    emoji: "\uD83C\uDFE0",
    accent: "bg-charcoal-700 text-cream-50",
    description: "Kitchen kit and home essentials for a new place.",
  },
  {
    id: "sympathy",
    label: "Sympathy",
    emoji: "\uD83E\uDD0D",
    accent: "bg-cream-200 text-charcoal-700",
    description: "Tasteful flowers and care for difficult times.",
  },
  {
    id: "student",
    label: "Student Care",
    emoji: "\uD83D\uDCDA",
    accent: "bg-mustard-100 text-mustard-700",
    description: "Snacks, stationery and morale boosters.",
  },
  {
    id: "holiday",
    label: "Holiday & Seasonal",
    emoji: "\uD83C\uDF89",
    accent: "bg-clay-400 text-cream-50",
    description: "Christmas, Easter, and seasonal celebrations.",
  },
  {
    id: "essentials",
    label: "Essentials",
    emoji: "\uD83C\uDF5A",
    accent: "bg-mustard-400 text-charcoal-900",
    description: "Everyday pantry and household basics.",
  },
  {
    id: "other",
    label: "Other",
    emoji: "\uD83C\uDF81",
    accent: "bg-charcoal-100 text-charcoal-700",
    description: "A custom thoughtful gift.",
  },
];

export const CATEGORY_BY_ID: Record<CarePackageCategory, CategoryMeta> =
  CARE_PACKAGE_CATEGORIES.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<CarePackageCategory, CategoryMeta>);

export const STATUS_TONE: Record<CarePackageStatus, string> = {
  active: "bg-sage-100 text-sage-700",
  draft: "bg-charcoal-100 text-charcoal-700",
  scheduled: "bg-mustard-100 text-mustard-700",
};

export const STATUS_LABEL: Record<CarePackageStatus, string> = {
  active: "Active",
  draft: "Draft",
  scheduled: "Scheduled",
};

/**
 * Sum of items \u00d7 sellingPrice. Used as the auto-suggested priceGHS
 * in the editor, and as the "items value" line below the override
 * field so admins can see the underlying cost.
 */
export function computePackageItemsTotal(
  pkg: Pick<CarePackage, "items">,
  products: Product[]
): number {
  return pkg.items.reduce((sum, item) => {
    const p = products.find((x) => x.id === item.productId);
    return sum + (p ? p.sellingPrice * item.quantity : 0);
  }, 0);
}

/** Total quantity of items in the package (sum of quantities). */
export function getPackageItemCount(
  pkg: Pick<CarePackage, "items">
): number {
  return pkg.items.reduce((sum, item) => sum + item.quantity, 0);
}

export type ItemAvailability =
  | "active"
  | "temporarily_unavailable"
  | "inactive"
  | "missing";

export interface ResolvedItem {
  productId: string;
  quantity: number;
  product?: Product;
  availability: ItemAvailability;
}

export interface PackageFulfillment {
  resolvedItems: ResolvedItem[];
  allActive: boolean;
  needsSubstitution: boolean;
  unfulfillable: boolean;
}

/**
 * Resolves each item in the package against the live product catalogue
 * and classifies the overall fulfillment posture. Drives the
 * "Substitutions may apply" / "Currently unavailable" badges on both
 * admin cards and customer cards.
 */
export function getPackageFulfillment(
  pkg: Pick<CarePackage, "items">,
  products: Product[]
): PackageFulfillment {
  const resolvedItems: ResolvedItem[] = pkg.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const availability: ItemAvailability = !product
      ? "missing"
      : (product.availability ??
          (product.active ? "active" : "inactive")) as ItemAvailability;
    return {
      productId: item.productId,
      quantity: item.quantity,
      product,
      availability,
    };
  });
  const allActive =
    resolvedItems.length > 0 &&
    resolvedItems.every((r) => r.availability === "active");
  const unfulfillable =
    resolvedItems.length === 0 ||
    resolvedItems.every((r) => r.availability !== "active");
  const needsSubstitution = !allActive && !unfulfillable;
  return { resolvedItems, allActive, needsSubstitution, unfulfillable };
}

/**
 * True when the care package should be visible to customers today \u2014
 * `active` always shows; `scheduled` only shows within its date range;
 * `draft` is never customer-visible.
 */
export function isCarePackageVisible(
  pkg: CarePackage,
  now: Date = new Date()
): boolean {
  if (pkg.status === "draft") return false;
  if (pkg.status === "active") return true;
  // scheduled
  const today = now.toISOString().slice(0, 10);
  if (pkg.availableFrom && today < pkg.availableFrom) return false;
  if (pkg.availableUntil && today > pkg.availableUntil) return false;
  return true;
}

/**
 * True when KAYA can fulfill this care package in the given
 * recipient's delivery area. Returns true when recipient is null so
 * the customer can still browse and discover packages before saving a
 * recipient.
 */
export function isCarePackageDeliverable(
  pkg: CarePackage,
  recipient: Recipient | null | undefined,
  deliveryAreas: DeliveryArea[]
): boolean {
  if (!recipient) return true;
  const area = deliveryAreas.find(
    (a) =>
      a.name === recipient.townArea &&
      a.city === recipient.city
  );
  if (!area || !area.serviceable || !area.active) return false;
  if (pkg.availabilityAreaIds && pkg.availabilityAreaIds.length > 0) {
    return pkg.availabilityAreaIds.includes(area.id);
  }
  return true;
}
