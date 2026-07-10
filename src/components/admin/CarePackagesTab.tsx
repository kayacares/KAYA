import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Gift,
  Heart,
  MessageSquare,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { uid } from "@/lib/utils";
import {
  CARE_PACKAGE_CATEGORIES,
  CATEGORY_BY_ID,
  STATUS_LABEL,
  STATUS_TONE,
  computePackageItemsTotal,
  getPackageFulfillment,
  getPackageItemCount,
} from "@/lib/carePackages";
import ImageUpload from "@/components/features/ImageUpload";
import type {
  CarePackage,
  CarePackageCategory,
  CarePackageStatus,
  DeliveryArea,
  Product,
  Shop,
} from "@/types";

const ACCENT_PRESETS = [
  {
    value:
      "bg-gradient-to-br from-mustard-400 to-mustard-600 text-charcoal-900",
    label: "Mustard",
  },
  {
    value:
      "bg-gradient-to-br from-sage-300 to-sage-500 text-charcoal-900",
    label: "Sage",
  },
  {
    value:
      "bg-gradient-to-br from-clay-400 to-mustard-400 text-cream-50",
    label: "Clay",
  },
  {
    value:
      "bg-gradient-to-br from-charcoal-700 to-charcoal-900 text-cream-50",
    label: "Charcoal",
  },
  {
    value:
      "bg-gradient-to-br from-mustard-700 to-clay-400 text-cream-50",
    label: "Deep gold",
  },
  {
    value:
      "bg-gradient-to-br from-sage-500 to-charcoal-700 text-cream-50",
    label: "Forest",
  },
];

type StatusFilter = "all" | CarePackageStatus | "featured";
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "featured", label: "Featured" },
];

export default function CarePackagesTab() {
  const {
    user,
    carePackages,
    products,
    shops,
    deliveryAreas,
    upsertCarePackage,
    duplicateCarePackage,
    deleteCarePackage,
    setCarePackageStatus,
    setCarePackageFeatured,
  } = useApp();
  const canCreate = can("care_packages.create", user);
  const canEdit = can("care_packages.edit", user);
  const canDelete = can("care_packages.delete", user);

  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterCategory, setFilterCategory] = useState<
    CarePackageCategory | "all"
  >("all");
  const [editing, setEditing] = useState<CarePackage | null>(null);
  const [isNew, setIsNew] = useState(false);

  const stats = useMemo(
    () => ({
      total: carePackages.length,
      active: carePackages.filter((p) => p.status === "active").length,
      draft: carePackages.filter((p) => p.status === "draft").length,
      scheduled: carePackages.filter((p) => p.status === "scheduled").length,
      featured: carePackages.filter((p) => p.featured).length,
    }),
    [carePackages]
  );

  const filtered = useMemo(() => {
    return carePackages
      .filter((p) => {
        if (filterStatus === "all") return true;
        if (filterStatus === "featured") return p.featured;
        return p.status === filterStatus;
      })
      .filter((p) => filterCategory === "all" || p.category === filterCategory)
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [carePackages, filterStatus, filterCategory]);

  const blank = (): CarePackage => ({
    id: uid("cp"),
    name: "",
    shortDescription: "",
    coverImage: "",
    emoji: "\uD83C\uDF81",
    accent: ACCENT_PRESETS[0].value,
    category: "essentials",
    priceGHS: 0,
    deliveryFeeGHS: 35,
    status: "draft",
    featured: false,
    items: [],
    giftOptions: {
      allowGiftWrap: true,
      giftWrapFeeGHS: 25,
      allowGreetingCard: true,
      allowPersonalMessage: true,
    },
    createdAt: new Date().toISOString(),
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="display text-2xl font-semibold">Care Packages</h2>
          <p className="text-sm text-charcoal-400 mt-1 max-w-prose">
            KAYA&apos;s signature curated gifts. Mix products from any shop,
            set the price and delivery fee, schedule availability, and feature
            your best sellers on the customer home page.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setEditing(blank());
              setIsNew(true);
            }}
            className="btn-primary text-sm py-2.5 px-4 inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus size={14} /> New care package
          </button>
        )}
      </div>

      {/* Metric tiles */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <MetricTile label="Active" value={stats.active} tone="sage" />
        <MetricTile label="Drafts" value={stats.draft} tone="charcoal" />
        <MetricTile
          label="Scheduled"
          value={stats.scheduled}
          tone="mustard"
        />
        <MetricTile label="Featured" value={stats.featured} tone="clay" />
      </section>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterStatus(f.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                filterStatus === f.id
                  ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                  : "bg-white border-charcoal-100 hover:border-charcoal-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          <button
            type="button"
            onClick={() => setFilterCategory("all")}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
              filterCategory === "all"
                ? "bg-mustard-400 text-charcoal-900 border-mustard-500"
                : "bg-white border-charcoal-100 hover:border-charcoal-400"
            }`}
          >
            <Tag size={11} /> All categories
          </button>
          {CARE_PACKAGE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterCategory(c.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                filterCategory === c.id
                  ? "bg-mustard-400 text-charcoal-900 border-mustard-500"
                  : "bg-white border-charcoal-100 hover:border-charcoal-400"
              }`}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <div className="text-5xl mb-2">\uD83C\uDF81</div>
          <p className="display text-xl font-semibold">
            {carePackages.length === 0
              ? "No care packages yet"
              : "Nothing matches that filter"}
          </p>
          <p className="text-sm text-charcoal-400 mt-1 max-w-sm mx-auto">
            {carePackages.length === 0
              ? "Build your first curated care package \u2014 mix products from any shop, set a price, and feature it on the customer home page."
              : "Try a different status or category."}
          </p>
          {canCreate && carePackages.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setEditing(blank());
                setIsNew(true);
              }}
              className="btn-primary mt-5 inline-flex"
            >
              <Plus size={14} /> Create care package
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((pkg) => (
            <AdminCard
              key={pkg.id}
              pkg={pkg}
              products={products}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => {
                setEditing(pkg);
                setIsNew(false);
              }}
              onDuplicate={() => duplicateCarePackage(pkg.id)}
              onToggleStatus={() =>
                setCarePackageStatus(
                  pkg.id,
                  pkg.status === "active" ? "draft" : "active"
                )
              }
              onToggleFeatured={() =>
                setCarePackageFeatured(pkg.id, !pkg.featured)
              }
              onDelete={() => deleteCarePackage(pkg.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <CarePackageEditor
          pkg={editing}
          isNew={isNew}
          products={products}
          shops={shops}
          deliveryAreas={deliveryAreas}
          canDelete={canDelete && !isNew}
          onClose={() => {
            setEditing(null);
            setIsNew(false);
          }}
          onSave={(updated) => {
            upsertCarePackage(updated);
            setEditing(null);
            setIsNew(false);
          }}
          onDelete={() => {
            deleteCarePackage(editing.id);
            setEditing(null);
            setIsNew(false);
          }}
        />
      )}
    </>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sage" | "charcoal" | "mustard" | "clay";
}) {
  const toneClass = {
    sage: "bg-sage-100 text-sage-700",
    charcoal: "bg-charcoal-100 text-charcoal-700",
    mustard: "bg-mustard-100 text-mustard-700",
    clay: "bg-clay-400/15 text-clay-600",
  }[tone];
  return (
    <div className="card-base p-3">
      <span className={`chip ${toneClass} text-[10px]`}>{label}</span>
      <p className="display text-2xl font-bold tabular-nums mt-1.5">{value}</p>
    </div>
  );
}

function AdminCard({
  pkg,
  products,
  canEdit,
  canDelete,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onToggleFeatured,
  onDelete,
}: {
  pkg: CarePackage;
  products: Product[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleStatus: () => void;
  onToggleFeatured: () => void;
  onDelete: () => void;
}) {
  const category = CATEGORY_BY_ID[pkg.category];
  const fulfillment = getPackageFulfillment(pkg, products);
  const itemCount = getPackageItemCount(pkg);

  return (
    <div className="card-base overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] bg-cream-100 overflow-hidden">
        {pkg.coverImage ? (
          <img
            src={pkg.coverImage}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className={`absolute inset-0 grid place-items-center ${pkg.accent}`}
          >
            <span className="text-6xl">{pkg.emoji}</span>
          </div>
        )}
        <span
          className={`absolute top-2 left-2 chip ${STATUS_TONE[pkg.status]} text-[10px] uppercase tracking-wider font-bold shadow-soft`}
        >
          {STATUS_LABEL[pkg.status]}
        </span>
        <button
          type="button"
          onClick={onToggleFeatured}
          disabled={!canEdit}
          aria-label={pkg.featured ? "Unfeature" : "Feature"}
          title={pkg.featured ? "Unfeature" : "Mark as featured"}
          className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full bg-white/95 backdrop-blur shadow-soft hover:scale-110 disabled:cursor-not-allowed transition"
        >
          <Star
            size={14}
            className={
              pkg.featured
                ? "text-mustard-500 fill-mustard-400"
                : "text-charcoal-400"
            }
          />
        </button>
        <span
          className={`absolute bottom-2 left-2 chip ${category.accent} text-[10px] shadow-soft`}
        >
          <span>{category.emoji}</span> {category.label}
        </span>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <h3 className="display font-semibold text-base text-charcoal-900 leading-tight line-clamp-1">
          {pkg.name}
        </h3>
        <p className="text-xs text-charcoal-400 mt-0.5 line-clamp-2 leading-snug min-h-[2.2em]">
          {pkg.shortDescription}
        </p>

        {fulfillment.unfulfillable ? (
          <span className="mt-2 chip bg-clay-400/15 text-clay-600 text-[10px] font-bold uppercase tracking-wider self-start">
            All items unavailable
          </span>
        ) : fulfillment.needsSubstitution ? (
          <span className="mt-2 chip bg-mustard-100 text-mustard-700 text-[10px] font-bold uppercase tracking-wider self-start">
            Substitutions may apply
          </span>
        ) : null}

        <div className="grid grid-cols-3 gap-1.5 mt-3 text-[11px]">
          <div className="rounded-xl bg-cream-100 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wider text-charcoal-400 font-bold">
              Items
            </p>
            <p className="font-bold tabular-nums">{itemCount}</p>
          </div>
          <div className="rounded-xl bg-cream-100 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wider text-charcoal-400 font-bold">
              Price
            </p>
            <p className="font-bold tabular-nums">{formatGHS(pkg.priceGHS)}</p>
          </div>
          <div className="rounded-xl bg-cream-100 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wider text-charcoal-400 font-bold">
              Delivery
            </p>
            <p className="font-bold tabular-nums">
              {formatGHS(pkg.deliveryFeeGHS)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5">
          {canEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 btn-outline text-xs py-2"
            >
              <Pencil size={12} /> Edit
            </button>
          ) : (
            <span className="flex-1 text-[11px] text-charcoal-400 text-center py-2">
              View only
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onDuplicate}
              aria-label="Duplicate"
              title="Duplicate"
              className="grid place-items-center w-9 h-9 rounded-2xl border border-charcoal-100 hover:border-charcoal-400 text-charcoal-700 transition"
            >
              <Copy size={13} />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onToggleStatus}
              aria-label={pkg.status === "active" ? "Set to draft" : "Activate"}
              title={
                pkg.status === "active" ? "Set to draft" : "Activate"
              }
              className="grid place-items-center w-9 h-9 rounded-2xl border border-charcoal-100 hover:border-charcoal-400 text-charcoal-700 transition"
            >
              {pkg.status === "active" ? (
                <Pause size={13} />
              ) : (
                <Play size={13} />
              )}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete"
              title="Delete"
              className="grid place-items-center w-9 h-9 rounded-2xl border border-clay-400/40 hover:bg-clay-400 hover:text-cream-50 text-clay-600 transition"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CarePackageEditor({
  pkg,
  isNew,
  products,
  shops,
  deliveryAreas,
  canDelete,
  onClose,
  onSave,
  onDelete,
}: {
  pkg: CarePackage;
  isNew: boolean;
  products: Product[];
  shops: Shop[];
  deliveryAreas: DeliveryArea[];
  canDelete: boolean;
  onClose: () => void;
  onSave: (pkg: CarePackage) => void;
  onDelete: () => void;
}) {
  const [p, setP] = useState<CarePackage>(pkg);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerShop, setPickerShop] = useState<string>("all");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const itemsTotal = useMemo(
    () => computePackageItemsTotal(p, products),
    [p.items, products]
  );

  const setPatch = (patch: Partial<CarePackage>) =>
    setP((prev) => ({ ...prev, ...patch }));

  const addItem = (productId: string) => {
    setP((prev) => {
      const existing = prev.items.find((it) => it.productId === productId);
      const newItems = existing
        ? prev.items.map((it) =>
            it.productId === productId
              ? { ...it, quantity: it.quantity + 1 }
              : it
          )
        : [...prev.items, { productId, quantity: 1 }];
      const prevComputed = computePackageItemsTotal(
        { items: prev.items },
        products
      );
      const newComputed = computePackageItemsTotal(
        { items: newItems },
        products
      );
      // Keep priceGHS synced with items unless admin explicitly overrode it.
      const synced = prev.priceGHS === prevComputed || prev.priceGHS === 0;
      return {
        ...prev,
        items: newItems,
        priceGHS: synced ? newComputed : prev.priceGHS,
      };
    });
  };

  const removeItem = (productId: string) => {
    setP((prev) => {
      const newItems = prev.items.filter((it) => it.productId !== productId);
      const prevComputed = computePackageItemsTotal(
        { items: prev.items },
        products
      );
      const newComputed = computePackageItemsTotal(
        { items: newItems },
        products
      );
      const synced = prev.priceGHS === prevComputed;
      return {
        ...prev,
        items: newItems,
        priceGHS: synced ? newComputed : prev.priceGHS,
      };
    });
  };

  const setItemQty = (productId: string, qty: number) => {
    if (qty <= 0) return removeItem(productId);
    setP((prev) => {
      const newItems = prev.items.map((it) =>
        it.productId === productId ? { ...it, quantity: qty } : it
      );
      const prevComputed = computePackageItemsTotal(
        { items: prev.items },
        products
      );
      const newComputed = computePackageItemsTotal(
        { items: newItems },
        products
      );
      const synced = prev.priceGHS === prevComputed;
      return {
        ...prev,
        items: newItems,
        priceGHS: synced ? newComputed : prev.priceGHS,
      };
    });
  };

  const pickerProducts = useMemo(() => {
    return products
      .filter((prod) => {
        if (pickerShop !== "all" && prod.shopId !== pickerShop) return false;
        if (pickerSearch) {
          const q = pickerSearch.toLowerCase();
          if (
            !prod.name.toLowerCase().includes(q) &&
            !(prod.brand?.toLowerCase().includes(q) ?? false)
          )
            return false;
        }
        const av =
          prod.availability ?? (prod.active ? "active" : "inactive");
        return av !== "inactive";
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, pickerSearch, pickerShop]);

  const itemMap = new Map(p.items.map((it) => [it.productId, it]));
  const canSave = p.name.trim().length > 0 && p.items.length > 0;
  const serviceableAreas = deliveryAreas.filter(
    (a) => a.active && a.serviceable
  );
  const giftOpts = p.giftOptions ?? {
    allowGiftWrap: false,
    allowGreetingCard: false,
    allowPersonalMessage: false,
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-charcoal-900/50"
          onClick={onClose}
        />
        <div className="relative bg-cream-50 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[94vh] flex flex-col">
          <div className="flex items-start justify-between p-5 pb-3 border-b border-charcoal-100/60 shrink-0">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700">
                {isNew ? "Create" : "Edit"}
              </p>
              <h3 className="display text-xl font-semibold leading-tight truncate">
                {isNew
                  ? "New care package"
                  : p.name || "Care package"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid place-items-center w-9 h-9 rounded-full bg-white border border-charcoal-100 hover:border-charcoal-400 shrink-0"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-6">
            <Section
              title="Cover image"
              subtitle="The hero customers see on care package cards. Falls back to the accent colour when empty."
            >
              <ImageUpload
                value={p.coverImage}
                onChange={(url) => setPatch({ coverImage: url })}
                bucket="product-images"
                folder={`care-packages/${p.id}`}
                aspect="video"
                hint="Landscape photo \u00b7 16:9 \u00b7 up to 10MB"
              />
            </Section>

            <Section title="Branding & story">
              <div className="grid grid-cols-1 gap-3">
                <Field label="Name" required>
                  <input
                    value={p.name}
                    placeholder="e.g. New Mother Care Package"
                    onChange={(e) => setPatch({ name: e.target.value })}
                    className="input-base"
                    maxLength={60}
                  />
                </Field>
                <Field label="Short description">
                  <textarea
                    value={p.shortDescription}
                    placeholder="One line shown on the customer card."
                    onChange={(e) =>
                      setPatch({ shortDescription: e.target.value })
                    }
                    className="input-base min-h-[60px]"
                    maxLength={140}
                  />
                </Field>
                <Field
                  label="Badge (optional)"
                  hint="Small chip overlaid on the card. e.g. 'Most loved'"
                >
                  <input
                    value={p.badge ?? ""}
                    placeholder="e.g. Most loved"
                    onChange={(e) =>
                      setPatch({ badge: e.target.value })
                    }
                    className="input-base"
                    maxLength={20}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Emoji">
                    <input
                      value={p.emoji}
                      onChange={(e) => setPatch({ emoji: e.target.value })}
                      maxLength={4}
                      className="input-base text-center text-xl"
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      value={p.category}
                      onChange={(e) =>
                        setPatch({
                          category: e.target.value as CarePackageCategory,
                        })
                      }
                      className="input-base"
                    >
                      {CARE_PACKAGE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
                    Accent style
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setPatch({ accent: preset.value })}
                        className={`${preset.value} rounded-2xl px-3 py-3 text-[11px] font-bold border-2 transition ${
                          p.accent === preset.value
                            ? "border-charcoal-900 scale-[1.03]"
                            : "border-transparent hover:scale-[1.03]"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Pricing & delivery">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Price (GHS)"
                  hint={`Items total: ${formatGHS(itemsTotal)}`}
                >
                  <input
                    type="number"
                    value={p.priceGHS}
                    onChange={(e) =>
                      setPatch({ priceGHS: Number(e.target.value) })
                    }
                    min={0}
                    className="input-base"
                  />
                </Field>
                <Field
                  label="Delivery fee (GHS)"
                  hint="Multi-shop fulfillment cost."
                >
                  <input
                    type="number"
                    value={p.deliveryFeeGHS}
                    onChange={(e) =>
                      setPatch({
                        deliveryFeeGHS: Number(e.target.value),
                      })
                    }
                    min={0}
                    className="input-base"
                  />
                </Field>
              </div>
              {itemsTotal !== p.priceGHS && itemsTotal > 0 && (
                <button
                  type="button"
                  onClick={() => setPatch({ priceGHS: itemsTotal })}
                  className="mt-2 text-xs font-semibold text-mustard-700 hover:underline"
                >
                  Sync price to items total ({formatGHS(itemsTotal)})
                </button>
              )}
            </Section>

            <Section title="Status & visibility">
              <div className="grid grid-cols-3 gap-2">
                {(["active", "draft", "scheduled"] as CarePackageStatus[]).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPatch({ status: s })}
                      className={`rounded-2xl px-3 py-2.5 text-xs font-bold border-2 transition ${
                        p.status === s
                          ? `${STATUS_TONE[s]} border-charcoal-900`
                          : "bg-white border-charcoal-100 hover:border-charcoal-400 text-charcoal-700"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  )
                )}
              </div>
              {p.status === "scheduled" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Available from">
                    <input
                      type="date"
                      value={p.availableFrom ?? ""}
                      onChange={(e) =>
                        setPatch({
                          availableFrom: e.target.value || undefined,
                        })
                      }
                      className="input-base"
                    />
                  </Field>
                  <Field label="Available until">
                    <input
                      type="date"
                      value={p.availableUntil ?? ""}
                      onChange={(e) =>
                        setPatch({
                          availableUntil: e.target.value || undefined,
                        })
                      }
                      className="input-base"
                    />
                  </Field>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm font-semibold pt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.featured}
                  onChange={(e) =>
                    setPatch({ featured: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <Star
                  size={14}
                  className={
                    p.featured
                      ? "fill-mustard-400 text-mustard-500"
                      : "text-charcoal-400"
                  }
                />
                Featured on the home page
              </label>
            </Section>

            <Section
              title="Gift options"
              subtitle="What can customers add when sending this package?"
            >
              <div className="space-y-2">
                <ToggleRow
                  icon={<Gift size={14} className="text-mustard-600" />}
                  label="Allow gift wrapping"
                  checked={giftOpts.allowGiftWrap}
                  onChange={(checked) =>
                    setPatch({
                      giftOptions: {
                        ...giftOpts,
                        allowGiftWrap: checked,
                      },
                    })
                  }
                />
                {giftOpts.allowGiftWrap && (
                  <Field label="Gift wrap fee (GHS)">
                    <input
                      type="number"
                      value={giftOpts.giftWrapFeeGHS ?? 0}
                      onChange={(e) =>
                        setPatch({
                          giftOptions: {
                            ...giftOpts,
                            giftWrapFeeGHS: Number(e.target.value),
                          },
                        })
                      }
                      min={0}
                      className="input-base"
                    />
                  </Field>
                )}
                <ToggleRow
                  icon={<Heart size={14} className="text-clay-600" />}
                  label="Allow greeting card"
                  checked={giftOpts.allowGreetingCard}
                  onChange={(checked) =>
                    setPatch({
                      giftOptions: {
                        ...giftOpts,
                        allowGreetingCard: checked,
                      },
                    })
                  }
                />
                <ToggleRow
                  icon={
                    <MessageSquare size={14} className="text-sage-700" />
                  }
                  label="Allow personal message"
                  checked={giftOpts.allowPersonalMessage}
                  onChange={(checked) =>
                    setPatch({
                      giftOptions: {
                        ...giftOpts,
                        allowPersonalMessage: checked,
                      },
                    })
                  }
                />
              </div>
            </Section>

            <Section
              title="Care Package Builder"
              subtitle="Add products from any shop. Customers receive every item listed below."
            >
              {p.items.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-sage-700 mb-1.5">
                    {p.items.length}{" "}
                    {p.items.length === 1 ? "item" : "items"} in package
                  </p>
                  <div className="space-y-1.5">
                    {p.items.map((item) => {
                      const prod = products.find(
                        (x) => x.id === item.productId
                      );
                      if (!prod) {
                        return (
                          <div
                            key={item.productId}
                            className="card-base p-2 flex items-center gap-2 border-clay-400/40"
                          >
                            <span className="grid place-items-center w-10 h-10 rounded-xl bg-clay-400/15 text-clay-600 shrink-0">
                              <X size={14} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-clay-600">
                                Product deleted
                              </p>
                              <p className="text-[10px] text-charcoal-400 truncate">
                                {item.productId}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.productId)}
                              className="grid place-items-center w-7 h-7 rounded-full text-charcoal-400 hover:text-clay-600"
                              aria-label="Remove"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      }
                      const shop = shops.find((s) => s.id === prod.shopId);
                      return (
                        <div
                          key={item.productId}
                          className="card-base p-2 flex items-center gap-2"
                        >
                          <img
                            src={prod.image}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover bg-cream-100 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {prod.name}
                            </p>
                            <p className="text-[10px] text-charcoal-400 truncate">
                              {shop?.emoji} {shop?.name} \u00b7{" "}
                              {formatGHS(prod.sellingPrice)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 bg-cream-100 rounded-full p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setItemQty(
                                  item.productId,
                                  item.quantity - 1
                                )
                              }
                              className="grid place-items-center w-7 h-7 rounded-full hover:bg-cream-200"
                              aria-label="Decrease"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="text-xs font-bold w-5 text-center tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setItemQty(
                                  item.productId,
                                  item.quantity + 1
                                )
                              }
                              className="grid place-items-center w-7 h-7 rounded-full hover:bg-cream-200"
                              aria-label="Increase"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="grid place-items-center w-7 h-7 rounded-full text-charcoal-400 hover:text-clay-600 shrink-0"
                            aria-label="Remove from package"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search products..."
                    className="input-base pl-9"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                  <button
                    type="button"
                    onClick={() => setPickerShop("all")}
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
                      pickerShop === "all"
                        ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                        : "bg-white border-charcoal-100 hover:border-charcoal-400"
                    }`}
                  >
                    All shops
                  </button>
                  {shops
                    .filter((s) => s.active)
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPickerShop(s.id)}
                        className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
                          pickerShop === s.id
                            ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                            : "bg-white border-charcoal-100 hover:border-charcoal-400"
                        }`}
                      >
                        <span>{s.emoji}</span> {s.name}
                      </button>
                    ))}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 rounded-2xl bg-cream-100 p-2">
                  {pickerProducts.length === 0 ? (
                    <p className="text-xs text-charcoal-400 text-center py-6">
                      No products match.
                    </p>
                  ) : (
                    pickerProducts.map((prod) => {
                      const isSelected = itemMap.has(prod.id);
                      const shop = shops.find((s) => s.id === prod.shopId);
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => addItem(prod.id)}
                          className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition ${
                            isSelected
                              ? "bg-sage-100 border border-sage-300/60"
                              : "bg-white border border-charcoal-100 hover:border-charcoal-400"
                          }`}
                        >
                          <img
                            src={prod.image}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover bg-cream-100 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {prod.name}
                            </p>
                            <p className="text-[10px] text-charcoal-400 truncate">
                              {shop?.emoji} {shop?.name} \u00b7{" "}
                              {formatGHS(prod.sellingPrice)}
                            </p>
                          </div>
                          <span
                            className={`grid place-items-center w-7 h-7 rounded-full shrink-0 ${
                              isSelected
                                ? "bg-sage-500 text-cream-50"
                                : "bg-mustard-400 text-charcoal-900"
                            }`}
                          >
                            {isSelected ? (
                              <Check size={12} />
                            ) : (
                              <Plus size={12} />
                            )}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </Section>

            {serviceableAreas.length > 0 && (
              <Section
                title="Delivery area availability"
                subtitle="Leave every area selected to make the care package available everywhere KAYA delivers."
              >
                <div className="flex flex-wrap gap-1.5">
                  {serviceableAreas.map((area) => {
                    const restricted =
                      !!p.availabilityAreaIds &&
                      p.availabilityAreaIds.length > 0;
                    const selected = restricted
                      ? p.availabilityAreaIds!.includes(area.id)
                      : true;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          if (!restricted) {
                            // First click switches from "all" to "specific minus this one"
                            setPatch({
                              availabilityAreaIds: serviceableAreas
                                .filter((a) => a.id !== area.id)
                                .map((a) => a.id),
                            });
                            return;
                          }
                          const next = p.availabilityAreaIds!.includes(area.id)
                            ? p.availabilityAreaIds!.filter(
                                (id) => id !== area.id
                              )
                            : [...p.availabilityAreaIds!, area.id];
                          // If now equals every serviceable area, reset to "all"
                          if (next.length === serviceableAreas.length) {
                            setPatch({ availabilityAreaIds: undefined });
                          } else {
                            setPatch({ availabilityAreaIds: next });
                          }
                        }}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition ${
                          selected
                            ? "bg-sage-100 border-sage-500 text-sage-700"
                            : "bg-white border-charcoal-100 text-charcoal-400 hover:border-charcoal-400"
                        }`}
                      >
                        {selected && (
                          <Check size={10} className="inline mr-1" />
                        )}
                        {area.name}, {area.city}
                      </button>
                    );
                  })}
                </div>
                {p.availabilityAreaIds &&
                  p.availabilityAreaIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPatch({ availabilityAreaIds: undefined })
                      }
                      className="mt-2 text-xs font-semibold text-mustard-700 hover:underline"
                    >
                      Reset to all serviceable areas
                    </button>
                  )}
              </Section>
            )}
          </div>

          <div className="border-t border-charcoal-100/60 p-4 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSave(p)}
              disabled={!canSave}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNew ? "Create care package" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-outline"
            >
              Cancel
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete care package"
                title="Delete"
                className="grid place-items-center w-12 h-12 rounded-2xl border border-clay-400 text-clay-600 hover:bg-clay-400 hover:text-cream-50 transition"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-charcoal-900/60"
            onClick={() => setConfirmingDelete(false)}
          />
          <div className="relative bg-cream-50 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5">
            <div className="grid place-items-center w-14 h-14 rounded-2xl bg-clay-400 text-cream-50 mb-3">
              <Trash2 size={22} />
            </div>
            <h3 className="display text-xl font-semibold leading-tight">
              Delete {p.name || "care package"}?
            </h3>
            <p className="text-sm text-charcoal-400 mt-1.5 leading-snug">
              This permanently removes the care package. Existing orders that
              reference it stay intact, but customers can no longer order it.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-clay-400 hover:bg-clay-600 text-cream-50 px-4 py-3 text-sm font-bold transition"
              >
                <Trash2 size={14} /> Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="display text-base font-semibold mb-0.5">{title}</h4>
      {subtitle && (
        <p className="text-xs text-charcoal-400 mb-3 max-w-prose leading-snug">
          {subtitle}
        </p>
      )}
      <div className={subtitle ? "" : "mt-2.5"}>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-charcoal-700">
      <span>
        {label}
        {required && <span className="text-clay-600 ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && (
        <span className="text-[11px] text-charcoal-400 font-normal block mt-1">
          {hint}
        </span>
      )}
    </label>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-charcoal-100 cursor-pointer hover:border-charcoal-400 transition">
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon} {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4"
      />
    </label>
  );
}
