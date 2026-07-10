import { useMemo, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import type { City, DeliveryArea } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { can } from "@/lib/permissions";
import { uid } from "@/lib/utils";

const REGIONS = ["Greater Accra"];
const CITIES: City[] = ["Accra", "Tema"];

export default function DeliveryAreasTab() {
  const { deliveryAreas, upsertDeliveryArea, removeDeliveryArea, user } =
    useApp();
  const [editing, setEditing] = useState<DeliveryArea | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);
  const [cityFilter, setCityFilter] = useState<"all" | City>("all");
  const canManage = can("delivery_areas.manage", user);

  const filtered = useMemo(() => {
    const list =
      cityFilter === "all"
        ? deliveryAreas
        : deliveryAreas.filter((a) => a.city === cityFilter);
    return [...list].sort(
      (a, b) =>
        a.city.localeCompare(b.city) || a.name.localeCompare(b.name)
    );
  }, [deliveryAreas, cityFilter]);

  const serviceableCount = deliveryAreas.filter(
    (a) => a.serviceable && a.active
  ).length;
  const activeCount = deliveryAreas.filter((a) => a.active).length;

  const blank = (): DeliveryArea => ({
    id: uid("da"),
    name: "",
    city: "Accra",
    region: "Greater Accra",
    zoneLabel: "",
    active: true,
    serviceable: true,
    createdAt: new Date().toISOString(),
  });

  return (
    <>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <h2 className="display text-2xl font-semibold">Delivery Areas</h2>
          <p className="text-sm text-charcoal-400">
            {serviceableCount} serviceable · {activeCount} active total
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditingIsNew(true);
              setEditing(blank());
            }}
            className="btn-primary text-xs"
          >
            <Plus size={12} /> New
          </button>
        )}
      </div>

      <div className="card-base border-mustard-400/30 bg-mustard-100 p-4 mb-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0">
            <MapPin size={18} />
          </span>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700">
              Operations control
            </p>
            <h3 className="display text-base font-semibold leading-tight">
              KAYA's editable service area list
            </h3>
            <p className="text-xs text-charcoal-700 mt-1 leading-snug">
              Customers pick a Town / Area from this list when adding a
              recipient. Toggle{" "}
              <span className="font-semibold">Serviceable</span> off to show a
              waitlist prompt instead. Toggle{" "}
              <span className="font-semibold">Active</span> off to hide the
              area from the dropdown entirely.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-4">
        <Pill
          label={`All · ${deliveryAreas.length}`}
          active={cityFilter === "all"}
          onClick={() => setCityFilter("all")}
        />
        {CITIES.map((c) => {
          const n = deliveryAreas.filter((a) => a.city === c).length;
          return (
            <Pill
              key={c}
              label={`${c} · ${n}`}
              active={cityFilter === c}
              onClick={() => setCityFilter(c)}
            />
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.map((area) => (
          <div
            key={area.id}
            className={`card-base p-3 ${!area.active ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${
                  area.serviceable && area.active
                    ? "bg-sage-100 text-sage-700"
                    : "bg-charcoal-100 text-charcoal-400"
                }`}
              >
                <MapPin size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{area.name}</p>
                <p className="text-xs text-charcoal-400 truncate">
                  {area.city} · {area.region}
                  {area.zoneLabel && ` · ${area.zoneLabel}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {!area.serviceable && (
                  <span className="chip bg-clay-400/15 text-clay-600 text-[9px]">
                    Not serviceable
                  </span>
                )}
                {!area.active && (
                  <span className="chip bg-charcoal-100 text-charcoal-400 text-[9px]">
                    Hidden
                  </span>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => {
                    setEditingIsNew(false);
                    setEditing(area);
                  }}
                  className="text-xs font-semibold underline shrink-0 ml-1"
                >
                  Edit
                </button>
              )}
            </div>
            {canManage && (
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() =>
                    upsertDeliveryArea({
                      ...area,
                      serviceable: !area.serviceable,
                    })
                  }
                  className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold border transition ${
                    area.serviceable
                      ? "bg-sage-100 border-sage-300 text-sage-700"
                      : "bg-charcoal-100 border-charcoal-200 text-charcoal-700"
                  }`}
                >
                  {area.serviceable ? "✓ Serviceable" : "Not serviceable"}
                </button>
                <button
                  onClick={() =>
                    upsertDeliveryArea({ ...area, active: !area.active })
                  }
                  className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold border transition ${
                    area.active
                      ? "bg-mustard-100 border-mustard-400 text-mustard-700"
                      : "bg-charcoal-100 border-charcoal-200 text-charcoal-400"
                  }`}
                >
                  {area.active ? "Active" : "Hidden"}
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card-base p-8 text-center text-sm text-charcoal-400">
            No delivery areas in this filter.
          </div>
        )}
      </div>

      {editing && (
        <AreaEditor
          area={editing}
          isNew={editingIsNew}
          canDelete={!editingIsNew && canManage}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            upsertDeliveryArea(a);
            setEditing(null);
          }}
          onDelete={() => {
            removeDeliveryArea(editing.id);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function AreaEditor({
  area,
  isNew,
  canDelete,
  onClose,
  onSave,
  onDelete,
}: {
  area: DeliveryArea;
  isNew: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSave: (a: DeliveryArea) => void;
  onDelete: () => void;
}) {
  const [a, setA] = useState<DeliveryArea>(area);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal-900/50" onClick={onClose} />
      <div className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
        <h3 className="display text-xl font-semibold mb-3">
          {isNew ? "New delivery area" : "Edit area"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Town / Area name</label>
            <input
              value={a.name}
              onChange={(e) => setA({ ...a, name: e.target.value })}
              className="input-base mt-1"
              placeholder="e.g. East Legon"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold">City</label>
              <select
                value={a.city}
                onChange={(e) =>
                  setA({ ...a, city: e.target.value as City })
                }
                className="input-base mt-1"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold">Region</label>
              <select
                value={a.region}
                onChange={(e) => setA({ ...a, region: e.target.value })}
                className="input-base mt-1"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold">
              Delivery zone label{" "}
              <span className="text-charcoal-400 font-normal">(optional)</span>
            </label>
            <input
              value={a.zoneLabel ?? ""}
              onChange={(e) => setA({ ...a, zoneLabel: e.target.value })}
              className="input-base mt-1"
              placeholder="e.g. Zone A"
            />
            <p className="text-[10px] text-charcoal-400 mt-1">
              Used by ops to group areas for routing & fees.
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Status
            </p>
            <label className="flex items-center gap-3 p-3 rounded-2xl border border-charcoal-100 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={a.active}
                onChange={(e) => setA({ ...a, active: e.target.checked })}
                className="w-4 h-4 accent-charcoal-800"
              />
              <span className="text-sm">
                <span className="font-semibold block">Active</span>
                <span className="text-[11px] text-charcoal-400">
                  Show in the customer Town / Area dropdown.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-2xl border border-charcoal-100 cursor-pointer">
              <input
                type="checkbox"
                checked={a.serviceable}
                onChange={(e) =>
                  setA({ ...a, serviceable: e.target.checked })
                }
                className="w-4 h-4 accent-charcoal-800"
              />
              <span className="text-sm">
                <span className="font-semibold block">Serviceable</span>
                <span className="text-[11px] text-charcoal-400">
                  KAYA delivers here today. Off shows a waitlist prompt.
                </span>
              </span>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => onSave(a)} className="btn-primary flex-1">
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
