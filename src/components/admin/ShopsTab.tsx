import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import { uid } from "@/lib/utils";
import ImageUpload from "@/components/features/ImageUpload";
import { can } from "@/lib/permissions";
import type { Shop } from "@/types";

/**
 * Tailwind accent presets used when creating or editing a shop. Each
 * value is a pair of classes (background + text colour) so the shop
 * card in the customer-facing grid stays consistent with the design
 * system.
 */
const ACCENT_PRESETS: { value: string; label: string }[] = [
  { value: "bg-mustard-400 text-charcoal-900", label: "Mustard" },
  { value: "bg-sage-300 text-charcoal-900", label: "Sage" },
  { value: "bg-clay-400 text-cream-50", label: "Clay" },
  { value: "bg-charcoal-700 text-cream-50", label: "Charcoal" },
  { value: "bg-mustard-700 text-cream-50", label: "Deep gold" },
  { value: "bg-sage-500 text-cream-50", label: "Forest" },
];

const EMOJI_PRESETS = [
  "🍚",
  "🍼",
  "🏠",
  "🎁",
  "🥬",
  "💊",
  "📚",
  "🛍️",
  "👕",
  "💄",
];

export default function ShopsTab() {
  const {
    shops,
    updateShop,
    addShop,
    deleteShop,
    products,
    orders,
    brandHeroUrl,
    setBrandHeroUrl,
    user,
  } = useApp();
  const [editing, setEditing] = useState<Shop | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);
  const canEditSettings = can("settings.edit", user);
  const canUploadImage = can("shops.upload_image", user);
  const canEditPricing = can("pricing.edit", user);
  const canEditShop = can("shops.edit", user);
  const canCreate = can("shops.create", user);
  const canDelete = can("shops.delete", user);

  const blank = (): Shop => ({
    id: uid("shop"),
    name: "",
    tagline: "",
    description: "",
    emoji: "🛍️",
    accent: ACCENT_PRESETS[0].value,
    minOrderGHS: 0,
    deliveryFeeGHS: 35,
    slaHours: 24,
    active: true,
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="display text-2xl font-semibold">Shops</h2>
          <p className="text-sm text-charcoal-400">
            {canEditPricing
              ? "Edit every shop detail — name, branding, pricing, fees, fulfillment SLA, photograph and active status."
              : canEditShop
              ? "Edit name, tagline, description, branding, photograph and active status. Pricing is locked to Super Admin."
              : canUploadImage
              ? "Upload the shop card photograph customers see on the home grid. Other edits are locked."
              : "View shop information. Edits are restricted to Manager and Super Admin."}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setEditingIsNew(true);
              setEditing(blank());
            }}
            className="btn-primary text-sm py-2.5 px-4 sm:shrink-0 inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> New shop
          </button>
        )}
      </div>

      {canEditSettings && (
        <section className="card-base p-4 mb-5 border-mustard-400/40">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700 mb-0.5">
                App branding
              </p>
              <h3 className="display text-lg font-semibold">
                Login hero photograph
              </h3>
              <p className="text-xs text-charcoal-400 mt-0.5">
                The photograph that anchors the welcome screen. Swap to refresh
                KAYA's first impression.
              </p>
            </div>
            {brandHeroUrl && (
              <button
                type="button"
                onClick={() => setBrandHeroUrl("")}
                className="text-xs font-semibold text-charcoal-400 hover:text-clay-600 shrink-0 underline-offset-2 hover:underline"
              >
                Reset to default
              </button>
            )}
          </div>
          <ImageUpload
            value={brandHeroUrl}
            onChange={setBrandHeroUrl}
            bucket="product-images"
            folder="brand"
            aspect="portrait"
            hint="Tall portrait photograph · displayed 3:4 on the login page"
          />
        </section>
      )}

      <div className="space-y-3">
        {shops.map((s) => {
          const linkedProducts = products.filter(
            (p) => p.shopId === s.id
          ).length;
          const linkedOrders = orders.filter((o) => o.shopId === s.id).length;
          return (
            <div key={s.id} className="card-base overflow-hidden">
              <div className={`p-4 ${s.accent}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-5xl">{s.emoji}</div>
                    <h3 className="display text-xl font-semibold mt-2">
                      {s.name}
                    </h3>
                    <p className="text-xs opacity-90">{s.tagline}</p>
                  </div>
                  <span
                    className={`chip ${
                      s.active
                        ? "bg-white/30 text-charcoal-900"
                        : "bg-charcoal-900 text-cream-50"
                    }`}
                  >
                    {s.active ? "Active" : "Off"}
                  </span>
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-charcoal-400">
                    Min order
                  </p>
                  <p className="display text-lg font-bold mt-1 tabular-nums">
                    {s.minOrderGHS > 0 ? formatGHS(s.minOrderGHS) : "None"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-charcoal-400">
                    Delivery fee
                  </p>
                  <p className="display text-lg font-bold mt-1 tabular-nums">
                    {formatGHS(s.deliveryFeeGHS)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-charcoal-400">
                    SLA
                  </p>
                  <p className="display text-lg font-bold mt-1 tabular-nums">
                    {s.slaHours} hrs
                  </p>
                </div>
              </div>
              <div className="px-4 pb-2 grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-2xl bg-cream-100 px-3 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-charcoal-400">
                    Products
                  </p>
                  <p className="font-bold tabular-nums">{linkedProducts}</p>
                </div>
                <div className="rounded-2xl bg-cream-100 px-3 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-charcoal-400">
                    Orders
                  </p>
                  <p className="font-bold tabular-nums">{linkedOrders}</p>
                </div>
              </div>
              {canUploadImage && (
                <div className="px-4 pb-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
                        Shop card photograph
                      </p>
                      <p className="text-[11px] text-charcoal-400 leading-snug mt-0.5">
                        Customers see this image on the home page shop grid and
                        at the top of the shop page. Falls back to the accent
                        colour when empty.
                      </p>
                    </div>
                    {s.image && (
                      <button
                        type="button"
                        onClick={() => updateShop(s.id, { image: "" })}
                        className="text-xs font-semibold text-charcoal-400 hover:text-clay-600 shrink-0 underline-offset-2 hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <ImageUpload
                    value={s.image}
                    onChange={(url) => updateShop(s.id, { image: url })}
                    bucket="product-images"
                    folder={`shops/${s.id}`}
                    aspect="video"
                    hint="Wide landscape photo · displayed 16:9 on the shop card"
                  />
                </div>
              )}
              <div className="p-4 pt-0">
                {canEditShop || canEditPricing ? (
                  <button
                    onClick={() => {
                      setEditingIsNew(false);
                      setEditing(s);
                    }}
                    className="btn-outline w-full text-sm"
                  >
                    Edit shop
                  </button>
                ) : (
                  <p className="text-[11px] text-charcoal-400 text-center px-2 leading-relaxed">
                    Shop editing is restricted to Manager and Super Admin.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <ShopEditor
          shop={editing}
          isNew={editingIsNew}
          canEditPricing={editingIsNew || canEditPricing}
          canDelete={!editingIsNew && canDelete}
          linkedProducts={
            editingIsNew
              ? 0
              : products.filter((p) => p.shopId === editing.id).length
          }
          linkedOrders={
            editingIsNew
              ? 0
              : orders.filter((o) => o.shopId === editing.id).length
          }
          onClose={() => {
            setEditing(null);
            setEditingIsNew(false);
          }}
          onSave={(updated) => {
            if (editingIsNew) {
              addShop(updated);
            } else {
              const { id: _id, ...patch } = updated;
              void _id;
              updateShop(updated.id, patch);
            }
            setEditing(null);
            setEditingIsNew(false);
          }}
          onDelete={() => {
            if (!editing) return;
            deleteShop(editing.id);
            setEditing(null);
            setEditingIsNew(false);
          }}
        />
      )}
    </>
  );
}

function ShopEditor({
  shop,
  isNew,
  canEditPricing,
  canDelete,
  linkedProducts,
  linkedOrders,
  onClose,
  onSave,
  onDelete,
}: {
  shop: Shop;
  isNew: boolean;
  canEditPricing: boolean;
  canDelete: boolean;
  linkedProducts: number;
  linkedOrders: number;
  onClose: () => void;
  onSave: (shop: Shop) => void;
  onDelete: () => void;
}) {
  const [s, setS] = useState<Shop>(shop);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const canSave = s.name.trim().length > 0;
  const canSafelyDelete = linkedProducts === 0 && linkedOrders === 0;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-charcoal-900/50"
          onClick={onClose}
        />
        <div className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700">
            {isNew ? "Create" : "Edit"}
          </p>
          <h3 className="display text-xl font-semibold leading-tight">
            {isNew ? "New shop" : `${s.emoji || "🛍️"} ${s.name || "Shop"}`}
          </h3>

          {/* Live preview tile — always visible so admins see exactly what
              customers will see as they tweak the shop card. */}
          <div className={`mt-4 rounded-2xl p-4 ${s.accent}`}>
            <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">
              Live preview
            </p>
            <div className="text-3xl mt-1.5">{s.emoji || "🛍️"}</div>
            <p className="display text-lg font-semibold leading-tight mt-1">
              {s.name || "Shop name"}
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              {s.tagline || "Short tagline appears here"}
            </p>
          </div>

          <div className="space-y-3 mt-4">
            <label className="block text-xs font-semibold text-charcoal-700">
              Shop name <span className="text-clay-600">*</span>
              <input
                value={s.name}
                placeholder="e.g. The Fresh Produce Shop"
                onChange={(e) => setS({ ...s, name: e.target.value })}
                className="input-base mt-1"
                required
              />
            </label>
            <label className="block text-xs font-semibold text-charcoal-700">
              Tagline
              <input
                value={s.tagline}
                placeholder="e.g. Fresh from the farm"
                onChange={(e) => setS({ ...s, tagline: e.target.value })}
                className="input-base mt-1"
              />
            </label>
            <label className="block text-xs font-semibold text-charcoal-700">
              Description
              <textarea
                value={s.description}
                placeholder="One-line description shown to customers when they tap the shop."
                onChange={(e) =>
                  setS({ ...s, description: e.target.value })
                }
                className="input-base mt-1 min-h-[60px]"
              />
            </label>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
                Emoji
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={s.emoji}
                  onChange={(e) => setS({ ...s, emoji: e.target.value })}
                  maxLength={4}
                  className="input-base w-20 text-center text-xl"
                />
                <div className="flex-1 flex gap-1 flex-wrap">
                  {EMOJI_PRESETS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setS({ ...s, emoji: e })}
                      className={`grid place-items-center w-9 h-9 rounded-xl text-lg transition ${
                        s.emoji === e
                          ? "bg-charcoal-900 ring-2 ring-mustard-400"
                          : "bg-cream-100 hover:bg-charcoal-100"
                      }`}
                      aria-label={`Use ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
                Accent color
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ACCENT_PRESETS.map((preset) => {
                  const active = s.accent === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setS({ ...s, accent: preset.value })}
                      className={`${preset.value} rounded-2xl px-3 py-2.5 text-[11px] font-bold transition border-2 ${
                        active
                          ? "border-charcoal-900 scale-[1.03]"
                          : "border-transparent hover:scale-[1.03]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block text-xs font-semibold text-charcoal-700">
              Minimum order value (GHS)
              <input
                type="number"
                value={s.minOrderGHS}
                onChange={(e) =>
                  setS({ ...s, minOrderGHS: Number(e.target.value) })
                }
                min={0}
                disabled={!canEditPricing}
                className="input-base mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="text-[11px] text-charcoal-400 font-normal block mt-1">
                {canEditPricing
                  ? "Set 0 for no minimum."
                  : "Locked — only Super Admin can change pricing."}
              </span>
            </label>
            <label className="block text-xs font-semibold text-charcoal-700">
              Delivery fee (GHS)
              <input
                type="number"
                value={s.deliveryFeeGHS}
                onChange={(e) =>
                  setS({ ...s, deliveryFeeGHS: Number(e.target.value) })
                }
                min={0}
                disabled={!canEditPricing}
                className="input-base mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </label>
            <label className="block text-xs font-semibold text-charcoal-700">
              Fulfillment SLA (hours)
              <input
                type="number"
                value={s.slaHours}
                onChange={(e) =>
                  setS({ ...s, slaHours: Number(e.target.value) })
                }
                min={1}
                disabled={!canEditPricing}
                className="input-base mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="text-[11px] text-charcoal-400 font-normal block mt-1">
                Target turnaround from payment to delivery.
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold pt-2">
              <input
                type="checkbox"
                checked={s.active}
                onChange={(e) => setS({ ...s, active: e.target.checked })}
                className="w-4 h-4"
              />
              Shop is active and accepting orders
            </label>
            {isNew && (
              <p className="text-[11px] text-charcoal-400 leading-snug bg-cream-100 rounded-2xl px-3 py-2">
                Tip: after creating, upload the shop card photograph from the
                shop's card on the list — customers see it on the home page grid.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onSave(s)}
                disabled={!canSave}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isNew ? "Create shop" : "Save changes"}
              </button>
              <button onClick={onClose} className="btn-outline">
                Cancel
              </button>
            </div>

            {canDelete && (
              <div className="mt-4 pt-4 border-t border-charcoal-100">
                <p className="text-[10px] uppercase tracking-wider font-bold text-clay-600 mb-1.5">
                  Danger zone
                </p>
                <p className="text-[11px] text-charcoal-400 leading-snug mb-2">
                  Permanently delete this shop. Only allowed when no products
                  or orders reference it. Consider deactivating instead.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl border border-clay-400 text-clay-600 hover:bg-clay-400 hover:text-cream-50 px-4 py-2.5 text-xs font-bold transition"
                >
                  <Trash2 size={13} /> Delete shop
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <DeleteShopConfirm
          shop={s}
          linkedProducts={linkedProducts}
          linkedOrders={linkedOrders}
          canSafelyDelete={canSafelyDelete}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            onDelete();
            setConfirmingDelete(false);
          }}
        />
      )}
    </>
  );
}

function DeleteShopConfirm({
  shop,
  linkedProducts,
  linkedOrders,
  canSafelyDelete,
  onCancel,
  onConfirm,
}: {
  shop: Shop;
  linkedProducts: number;
  linkedOrders: number;
  canSafelyDelete: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal-900/60" onClick={onCancel} />
      <div className="relative bg-cream-50 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-clay-400 text-cream-50 mb-3">
          <AlertTriangle size={22} />
        </div>
        <h3 className="display text-xl font-semibold leading-tight">
          Delete {shop.name || "shop"}?
        </h3>
        <p className="text-sm text-charcoal-400 mt-1.5 leading-snug">
          This permanently removes the shop. The action cannot be undone.
        </p>

        <div className="mt-4 space-y-2">
          <CountRow label="Linked products" value={linkedProducts} />
          <CountRow label="Linked orders" value={linkedOrders} />
        </div>

        {!canSafelyDelete ? (
          <div className="mt-3 rounded-2xl bg-clay-400/10 border border-clay-400/30 p-3 text-xs text-clay-600 leading-snug">
            <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">
              Blocked
            </span>
            Reassign or remove the linked
            {linkedProducts > 0
              ? ` ${linkedProducts} product${
                  linkedProducts === 1 ? "" : "s"
                }`
              : ""}
            {linkedProducts > 0 && linkedOrders > 0 ? " and" : ""}
            {linkedOrders > 0
              ? ` ${linkedOrders} order${linkedOrders === 1 ? "" : "s"}`
              : ""}{" "}
            first. You can deactivate the shop in the meantime to hide it from
            customers.
          </div>
        ) : (
          <div className="mt-3 rounded-2xl bg-sage-100 border border-sage-300/40 p-3 text-xs text-sage-700 leading-snug">
            <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">
              Safe to delete
            </span>
            No products or orders reference this shop.
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canSafelyDelete}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-clay-400 hover:bg-clay-600 text-cream-50 px-4 py-3 text-sm font-bold transition disabled:bg-charcoal-100 disabled:text-charcoal-400 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            {canSafelyDelete ? "Yes, delete shop" : "Locked"}
          </button>
          <button type="button" onClick={onCancel} className="btn-outline">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  const tone =
    value === 0
      ? "bg-sage-100 text-sage-700"
      : "bg-clay-400/15 text-clay-600";
  return (
    <div className="flex items-center justify-between gap-3 bg-white rounded-2xl px-3 py-2 border border-charcoal-100/60">
      <span className="text-xs font-semibold text-charcoal-700">{label}</span>
      <span className={`chip ${tone} tabular-nums`}>{value}</span>
    </div>
  );
}
