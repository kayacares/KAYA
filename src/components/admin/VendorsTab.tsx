import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import type { City, Shop, Vendor } from "@/types";
import { uid } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { can } from "@/lib/permissions";

export default function VendorsTab() {
  const { vendors, shops, upsertVendor, deleteVendor, user } = useApp();
  const [editing, setEditing] = useState<Vendor | null>(null);
  const canCreate = can("vendors.create", user);
  const canEdit = can("vendors.edit", user);
  const canDelete = can("vendors.delete", user);

  const blank = (): Vendor => ({
    id: uid("v"),
    name: "",
    contact: "",
    address: "",
    city: "Accra",
    coverageAreas: ["Accra"],
    categories: ["provision"],
    active: true,
  });

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h2 className="display text-2xl font-semibold">Vendors</h2>
          <p className="text-sm text-charcoal-400">
            {vendors.length} vendors · {vendors.filter((v) => v.active).length}{" "}
            active
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setEditing(blank())}
            className="btn-primary text-xs"
          >
            + New
          </button>
        )}
      </div>

      <div className="space-y-2">
        {vendors.map((v) => (
          <div key={v.id} className="card-base p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="display font-semibold">{v.name}</p>
                  <span
                    className={`chip text-[10px] ${
                      v.active
                        ? "bg-sage-100 text-sage-700"
                        : "bg-charcoal-100 text-charcoal-400"
                    }`}
                  >
                    {v.active ? "Active" : "Off"}
                  </span>
                </div>
                <p className="text-xs text-charcoal-400 mt-0.5">{v.contact}</p>
                {v.address && (
                  <p className="text-xs text-charcoal-700 mt-1 flex items-start gap-1">
                    <MapPin
                      size={12}
                      className="mt-0.5 shrink-0 text-charcoal-400"
                    />
                    <span className="leading-snug">
                      {v.address}
                      {v.city ? `, ${v.city}` : ""}
                    </span>
                  </p>
                )}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {v.coverageAreas.map((c) => (
                    <span
                      key={c}
                      className="chip bg-cream-100 text-charcoal-700"
                    >
                      📍 {c}
                    </span>
                  ))}
                  {v.categories.map((c) => {
                    const shop = shops.find((s) => s.id === c);
                    return (
                      <span
                        key={c}
                        className="chip bg-mustard-100 text-mustard-700"
                      >
                        {shop?.emoji} {shop?.name ?? c}
                      </span>
                    );
                  })}
                </div>
              </div>
              {canEdit ? (
                <button
                  onClick={() => setEditing(v)}
                  className="text-xs font-semibold underline shrink-0"
                >
                  Edit
                </button>
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold shrink-0">
                  View only
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <VendorEditor
          vendor={editing}
          canDelete={canDelete}
          shops={shops}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            upsertVendor(v);
            setEditing(null);
          }}
          onDelete={() => {
            deleteVendor(editing.id);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function VendorEditor({
  vendor,
  canDelete,
  shops,
  onClose,
  onSave,
  onDelete,
}: {
  vendor: Vendor;
  canDelete: boolean;
  shops: Shop[];
  onClose: () => void;
  onSave: (v: Vendor) => void;
  onDelete: () => void;
}) {
  const [v, setV] = useState<Vendor>(vendor);
  const cities: City[] = ["Accra", "Tema"];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal-900/50" onClick={onClose} />
      <div className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
        <h3 className="display text-xl font-semibold mb-3">Vendor</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Business name
            </label>
            <input
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
              className="input-base mt-1"
              placeholder="e.g. Accra Wholesaler"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Contact
            </label>
            <input
              value={v.contact}
              onChange={(e) => setV({ ...v, contact: e.target.value })}
              className="input-base mt-1"
              placeholder="Phone or email"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Pickup / business address
            </label>
            <textarea
              value={v.address ?? ""}
              onChange={(e) => setV({ ...v, address: e.target.value })}
              className="input-base mt-1 min-h-[72px] resize-none"
              placeholder="Street, landmark, neighbourhood (e.g. Shop 14, Makola Market, Kojo Thompson Rd)"
              rows={3}
            />
            <p className="text-[10px] text-charcoal-400 mt-1">
              Used by Ops to coordinate pickups and confirm fulfillment.
            </p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              City
            </label>
            <div className="flex gap-2 mt-1">
              {cities.map((c) => {
                const on = v.city === c;
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setV({ ...v, city: c })}
                    className={`chip ${
                      on
                        ? "bg-charcoal-800 text-cream-50"
                        : "bg-white border border-charcoal-100"
                    }`}
                  >
                    📍 {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1">
              Coverage zones
            </p>
            <div className="flex gap-2">
              {cities.map((c) => {
                const on = v.coverageAreas.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() =>
                      setV({
                        ...v,
                        coverageAreas: on
                          ? v.coverageAreas.filter((x) => x !== c)
                          : [...v.coverageAreas, c],
                      })
                    }
                    className={`chip ${
                      on
                        ? "bg-charcoal-800 text-cream-50"
                        : "bg-white border border-charcoal-100"
                    }`}
                  >
                    📍 {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1">
              Shop categories
            </p>
            <div className="flex gap-2 flex-wrap">
              {shops.map((s) => {
                const on = v.categories.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() =>
                      setV({
                        ...v,
                        categories: on
                          ? v.categories.filter((x) => x !== s.id)
                          : [...v.categories, s.id],
                      })
                    }
                    className={`chip ${
                      on
                        ? "bg-mustard-400 text-charcoal-900"
                        : "bg-white border border-charcoal-100"
                    }`}
                  >
                    {s.emoji} {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={v.active}
              onChange={(e) => setV({ ...v, active: e.target.checked })}
              className="w-4 h-4"
            />
            Active and accepting assignments
          </label>

          <div className="flex gap-2 pt-2">
            <button onClick={() => onSave(v)} className="btn-primary flex-1">
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
