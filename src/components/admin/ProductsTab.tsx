import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import { uid } from "@/lib/utils";
import ImageUpload from "@/components/features/ImageUpload";
import ProductImportModal from "@/components/admin/ProductImportModal";
import { ROLE_LABEL, can, getRole } from "@/lib/permissions";
import type { Product, ProductAvailability, Shop, Vendor } from "@/types";

const AVAILABILITY_OPTIONS: {
  value: ProductAvailability;
  label: string;
  chip: string;
}[] = [
  { value: "active", label: "Active", chip: "bg-sage-100 text-sage-700" },
  {
    value: "temporarily_unavailable",
    label: "Temporarily Unavailable",
    chip: "bg-mustard-100 text-mustard-700",
  },
  {
    value: "inactive",
    label: "Inactive",
    chip: "bg-charcoal-100 text-charcoal-400",
  },
];

/**
 * Resolve the multi-vendor list for a product, falling back to the
 * legacy single `vendorId` when `vendorIds` is missing or empty.
 */
function resolveVendorIds(product: Product): string[] {
  if (product.vendorIds && product.vendorIds.length > 0) {
    return product.vendorIds;
  }
  return product.vendorId ? [product.vendorId] : [];
}

export default function ProductsTab() {
  const {
    products,
    vendors,
    shops,
    upsertProduct,
    deleteProduct,
    setProductAvailability,
    highValueThresholdGHS,
    setHighValueThreshold,
    user,
  } = useApp();
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);
  const [shopFilter, setShopFilter] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState<string>(
    String(highValueThresholdGHS)
  );
  const canCreate = can("products.create", user);
  const canEdit = can("products.edit", user);
  const canEditPricing = can("pricing.edit", user);
  const canDelete = can("products.delete", user);
  const canChangeAvailability = can("products.availability", user);
  const canEditSettings = can("settings.edit", user);

  // Keep the threshold input synced if a different super-admin updates it.
  useEffect(() => {
    setThresholdDraft(String(highValueThresholdGHS));
  }, [highValueThresholdGHS]);

  const blank = (): Product => ({
    id: uid("p"),
    name: "",
    shopId: "provision",
    vendorId: vendors[0]?.id ?? "",
    vendorIds: vendors[0] ? [vendors[0].id] : [],
    vendorCost: 0,
    sellingPrice: 0,
    unit: "",
    category: "",
    image: "",
    active: true,
    availability: "active",
  });

  const filtered =
    shopFilter === "all"
      ? products
      : products.filter((p) => p.shopId === shopFilter);

  const saveThreshold = () => {
    const n = Number(thresholdDraft);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Threshold must be a positive number.");
      setThresholdDraft(String(highValueThresholdGHS));
      return;
    }
    setHighValueThreshold(n);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
        <div>
          <h2 className="display text-2xl font-semibold">Products</h2>
          <p className="text-sm text-charcoal-400">
            {products.length} total ·{" "}
            {canChangeAvailability
              ? "tap a chip to change availability"
              : "prices stored in GHS"}
          </p>
        </div>
        {canCreate ? (
          <div className="flex items-stretch gap-2 sm:shrink-0">
            <button
              onClick={() => setImportOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-full bg-mustard-400 hover:bg-mustard-500 text-charcoal-900 px-4 py-2.5 text-sm font-bold transition shadow-soft"
              title="Bulk import from Excel (.xlsx)"
            >
              <FileSpreadsheet size={14} /> Import .xlsx
            </button>
            <button
              onClick={() => {
                setEditingIsNew(true);
                setEditing(blank());
              }}
              className="flex-1 sm:flex-initial btn-primary text-sm py-2.5"
            >
              + New
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-charcoal-400 leading-snug bg-cream-100 rounded-2xl px-3 py-2 sm:max-w-xs">
            Bulk Excel import is available to Super Admin & Manager accounts.
            You're signed in as{" "}
            <span className="font-semibold text-charcoal-700">
              {ROLE_LABEL[getRole(user)]}
            </span>
            .
          </p>
        )}
      </div>

      {canEditSettings && (
        <div className="card-base border-clay-400/30 bg-clay-400/5 p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-clay-400 text-cream-50 shrink-0">
              <ShieldAlert size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-clay-600">
                Customer protection
              </p>
              <h3 className="display text-base font-semibold leading-tight">
                High-value substitution threshold
              </h3>
              <p className="text-xs text-charcoal-400 mt-1 leading-snug">
                Products at or above this price never auto-substitute —
                customer approval is always required. Currently{" "}
                <span className="font-semibold text-charcoal-700">
                  {formatGHS(highValueThresholdGHS)}
                </span>
                .
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-xs font-semibold pointer-events-none">
                    GH₵
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={thresholdDraft}
                    onChange={(e) => setThresholdDraft(e.target.value)}
                    className="input-base pl-14 text-sm py-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveThreshold}
                  disabled={Number(thresholdDraft) === highValueThresholdGHS}
                  className="btn-primary text-xs py-2 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-4">
        <Pill
          label={`All · ${products.length}`}
          active={shopFilter === "all"}
          onClick={() => setShopFilter("all")}
        />
        {shops.map((s) => {
          const c = products.filter((p) => p.shopId === s.id).length;
          return (
            <Pill
              key={s.id}
              label={`${s.emoji} ${s.name} · ${c}`}
              active={shopFilter === s.id}
              onClick={() => setShopFilter(s.id)}
            />
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.map((p) => {
          const margin = p.sellingPrice - p.vendorCost;
          const marginPct =
            p.sellingPrice > 0 ? (margin / p.sellingPrice) * 100 : 0;
          const availability: ProductAvailability =
            p.availability ?? (p.active ? "active" : "inactive");
          const opt =
            AVAILABILITY_OPTIONS.find((o) => o.value === availability) ??
            AVAILABILITY_OPTIONS[0];
          const isHighValue = p.sellingPrice >= highValueThresholdGHS;
          const vIds = resolveVendorIds(p);
          const vendorNames = vIds
            .map((id) => vendors.find((v) => v.id === id)?.name)
            .filter(Boolean) as string[];
          const vendorSummary =
            vendorNames.length === 0
              ? "No vendor"
              : vendorNames.length === 1
              ? vendorNames[0]
              : `${vendorNames[0]} +${vendorNames.length - 1} more`;
          return (
            <div key={p.id} className="card-base p-3">
              <div className="flex items-center gap-3">
                <img
                  src={p.image}
                  className="w-12 h-12 rounded-xl object-cover bg-cream-100 shrink-0"
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate flex items-center gap-1.5">
                    <span className="truncate">{p.name}</span>
                    {isHighValue && (
                      <span
                        title={`High-value (≥ ${formatGHS(
                          highValueThresholdGHS
                        )}) — auto-substitution disabled`}
                        className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-clay-400/15 text-clay-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      >
                        <ShieldAlert size={9} /> High value
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-charcoal-400">
                    cost {formatGHS(p.vendorCost)} · sell{" "}
                    {formatGHS(p.sellingPrice)}{" "}
                    <span className="text-sage-700 font-semibold">
                      +{marginPct.toFixed(0)}%
                    </span>
                  </p>
                  <p className="text-[10px] text-charcoal-400 truncate mt-0.5">
                    {vendorNames.length > 1 ? (
                      <span className="font-semibold text-charcoal-700">
                        {vendorNames.length} vendors ·{" "}
                      </span>
                    ) : null}
                    {vendorSummary}
                  </p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingIsNew(false);
                      setEditing(p);
                    }}
                    className="text-xs font-semibold underline shrink-0"
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="mt-2.5">
                {canChangeAvailability ? (
                  <select
                    value={availability}
                    onChange={(e) =>
                      setProductAvailability(
                        p.id,
                        e.target.value as ProductAvailability
                      )
                    }
                    className={`w-full rounded-full px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-charcoal-800/30 ${opt.chip}`}
                  >
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`chip ${opt.chip}`}>{opt.label}</span>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card-base p-8 text-center text-sm text-charcoal-400">
            No products match.
          </div>
        )}
      </div>

      {editing && (
        <ProductEditor
          product={editing}
          isNew={editingIsNew}
          canEditPricing={editingIsNew || canEditPricing}
          canDelete={!editingIsNew && canDelete}
          vendors={vendors}
          shops={shops}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            upsertProduct(p);
            setEditing(null);
          }}
          onDelete={() => {
            deleteProduct(editing.id);
            setEditing(null);
          }}
        />
      )}

      {importOpen && (
        <ProductImportModal onClose={() => setImportOpen(false)} />
      )}
    </>
  );
}

function ProductEditor({
  product,
  isNew,
  canEditPricing,
  canDelete,
  vendors,
  shops,
  onClose,
  onSave,
  onDelete,
}: {
  product: Product;
  isNew: boolean;
  canEditPricing: boolean;
  canDelete: boolean;
  vendors: Vendor[];
  shops: Shop[];
  onClose: () => void;
  onSave: (p: Product) => void;
  onDelete: () => void;
}) {
  const [p, setP] = useState<Product>({
    ...product,
    availability:
      product.availability ?? (product.active ? "active" : "inactive"),
    vendorIds: resolveVendorIds(product),
  });
  const setAvailability = (val: ProductAvailability) =>
    setP({ ...p, availability: val, active: val === "active" });

  const selectedVendorIds = p.vendorIds ?? [];
  const toggleVendor = (id: string) => {
    const isSelected = selectedVendorIds.includes(id);
    const next = isSelected
      ? selectedVendorIds.filter((x) => x !== id)
      : [...selectedVendorIds, id];
    setP({
      ...p,
      vendorIds: next,
      // Keep legacy `vendorId` synced to the first selected vendor so
      // older code paths that still read product.vendorId keep working.
      vendorId: next[0] ?? "",
    });
  };

  const handleSave = () => {
    if (!p.name.trim()) {
      toast.error("Product name is required.");
      return;
    }
    if (selectedVendorIds.length === 0) {
      toast.error("Select at least one vendor for this product.");
      return;
    }
    onSave({
      ...p,
      vendorId: selectedVendorIds[0],
      vendorIds: selectedVendorIds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal-900/50" onClick={onClose} />
      <div className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
        <h3 className="display text-xl font-semibold mb-3">
          {isNew ? "New product" : "Edit product"}
        </h3>
        <div className="space-y-3">
          <input
            value={p.name}
            placeholder="Name"
            onChange={(e) => setP({ ...p, name: e.target.value })}
            className="input-base"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={p.brand ?? ""}
              placeholder="Brand (optional)"
              onChange={(e) =>
                setP({ ...p, brand: e.target.value || undefined })
              }
              className="input-base"
            />
            <input
              value={p.sku ?? ""}
              placeholder="SKU (optional)"
              onChange={(e) =>
                setP({ ...p, sku: e.target.value || undefined })
              }
              className="input-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={p.category}
              placeholder="Category"
              onChange={(e) => setP({ ...p, category: e.target.value })}
              className="input-base"
            />
            <input
              value={p.unit}
              placeholder="Size / variant (e.g. 5kg bag)"
              onChange={(e) => setP({ ...p, unit: e.target.value })}
              className="input-base"
            />
          </div>
          <input
            value={p.deliveryClass ?? ""}
            placeholder="Delivery class (optional, e.g. standard / bulky)"
            onChange={(e) =>
              setP({ ...p, deliveryClass: e.target.value || undefined })
            }
            className="input-base"
          />
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Shop
            </p>
            <select
              value={p.shopId}
              onChange={(e) =>
                setP({ ...p, shopId: e.target.value })
              }
              className="input-base"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
                Vendors <span className="text-clay-600">*</span>
              </p>
              <span
                className={`text-[10px] font-bold tabular-nums ${
                  selectedVendorIds.length === 0
                    ? "text-clay-600"
                    : "text-charcoal-700"
                }`}
              >
                {selectedVendorIds.length} selected
              </span>
            </div>
            {vendors.length === 0 ? (
              <div className="rounded-2xl bg-cream-100 px-3 py-2 text-xs text-charcoal-400">
                No vendors yet — add one in the Vendors tab.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {vendors.map((v) => {
                  const on = selectedVendorIds.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleVendor(v.id)}
                      className={`rounded-2xl border px-2.5 py-2 text-[11px] font-semibold text-left flex items-center gap-1.5 transition leading-tight ${
                        on
                          ? "border-charcoal-800 bg-charcoal-800 text-cream-50"
                          : "border-charcoal-100 bg-white hover:border-charcoal-400 text-charcoal-700"
                      }`}
                    >
                      <span
                        className={`grid place-items-center w-4 h-4 rounded-full shrink-0 ${
                          on
                            ? "bg-mustard-400 text-charcoal-900"
                            : "bg-charcoal-100 text-transparent"
                        }`}
                      >
                        <Check size={9} strokeWidth={3} />
                      </span>
                      <span className="truncate">{v.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-charcoal-400 mt-1.5 leading-snug">
              {selectedVendorIds.length > 1
                ? "Ops can pick any of these vendors when assigning the order."
                : "Tap to select at least one vendor. Tap multiple if more than one vendor stocks this item."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold">
              Vendor cost (GHS)
              <input
                type="number"
                value={p.vendorCost}
                onChange={(e) =>
                  setP({ ...p, vendorCost: Number(e.target.value) })
                }
                className="input-base mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!canEditPricing}
              />
            </label>
            <label className="text-xs font-semibold">
              Selling price (GHS)
              <input
                type="number"
                value={p.sellingPrice}
                onChange={(e) =>
                  setP({ ...p, sellingPrice: Number(e.target.value) })
                }
                className="input-base mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!canEditPricing}
              />
            </label>
          </div>
          {!canEditPricing && (
            <p className="text-[11px] text-charcoal-400 -mt-1 leading-snug">
              Pricing locked — only Super Admin can change vendor cost or
              selling price on existing products.
            </p>
          )}
          <ImageUpload
            value={p.image}
            onChange={(url) => setP({ ...p, image: url })}
            bucket="product-images"
            folder="catalog"
            label="Product image"
            aspect="square"
          />
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Availability
            </p>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABILITY_OPTIONS.map((o) => {
                const active = (p.availability ?? "active") === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setAvailability(o.value)}
                    className={`rounded-2xl border px-2 py-2 text-[11px] font-semibold transition leading-tight ${
                      active
                        ? "border-charcoal-800 bg-charcoal-800 text-cream-50"
                        : "border-charcoal-100 bg-white hover:border-charcoal-400"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-charcoal-400 mt-1.5 leading-snug">
              Active shows on the shop. Temporarily Unavailable shows with a
              greyed-out badge. Inactive hides the product entirely.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="btn-primary flex-1">
              Save
            </button>
            {canDelete && (
              <button onClick={onDelete} className="btn-outline text-clay-600">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
        active
          ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
          : "bg-white border-charcoal-100 text-charcoal-700 hover:border-charcoal-400"
      }`}
    >
      {label}
    </button>
  );
}
