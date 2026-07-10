import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Clock4,
  Pause,
  Play,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { can } from "@/lib/permissions";
import { uid } from "@/lib/utils";
import {
  DAY_LABELS_SHORT,
  formatHour,
  getAvailableDates,
  getWindowAvailability,
  todayISO,
} from "@/lib/deliverySchedule";
import type { DeliveryWindow } from "@/types";

export default function DeliveryScheduleTab() {
  const {
    deliveryScheduleConfig: config,
    updateDeliveryScheduleConfig,
    upsertDeliveryWindow,
    removeDeliveryWindow,
    orders,
    user,
  } = useApp();
  const [editing, setEditing] = useState<DeliveryWindow | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);
  const canManage = can("settings.edit", user);

  const activeWindowsCount = config.windows.filter((w) => w.active).length;
  const previewDates = useMemo(
    () => getAvailableDates(config, orders).slice(0, 7),
    [config, orders]
  );

  const blank = (): DeliveryWindow => ({
    id: uid("dw"),
    label: "",
    rangeLabel: "",
    startHour: 8,
    endHour: 12,
    active: true,
    capacity: 15,
  });

  const toggleDay = (day: number) => {
    if (!canManage) return;
    const has = config.daysAvailable.includes(day);
    if (has && config.daysAvailable.length <= 1) {
      toast.error("Keep at least one delivery day.");
      return;
    }
    const next = has
      ? config.daysAvailable.filter((d) => d !== day)
      : [...config.daysAvailable, day].sort();
    updateDeliveryScheduleConfig({ daysAvailable: next });
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="display text-2xl font-semibold">Delivery Schedule</h2>
        <p className="text-sm text-charcoal-400">
          {config.windows.length} window
          {config.windows.length === 1 ? "" : "s"} · {activeWindowsCount} active
          · cutoff {formatHour(config.sameDayCutoffHour)} ·{" "}
          {config.daysAvailable.length} day
          {config.daysAvailable.length === 1 ? "" : "s"} a week
        </p>
      </div>

      <div className="card-base border-sage-300/40 bg-sage-100 p-4 mb-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-sage-500 text-cream-50 shrink-0">
            <CalendarClock size={18} />
          </span>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-sage-700">
              Operations control
            </p>
            <h3 className="display text-base font-semibold leading-tight">
              How customers schedule deliveries
            </h3>
            <p className="text-xs text-charcoal-700 mt-1 leading-snug">
              These settings power the date + window picker at checkout.
              Windows automatically disappear once daily capacity is full, and
              same-day delivery hides past the cutoff time.
            </p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2 text-charcoal-700">
            <Clock4 size={14} />
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Same-day cutoff
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              min={0}
              max={23}
              value={config.sameDayCutoffHour}
              disabled={!canManage}
              onChange={(e) =>
                updateDeliveryScheduleConfig({
                  sameDayCutoffHour: Number(e.target.value),
                })
              }
              className="input-base w-20 text-center tabular-nums disabled:opacity-60"
            />
            <span className="text-sm font-semibold text-charcoal-700">
              {formatHour(config.sameDayCutoffHour)}
            </span>
          </div>
          <p className="text-[11px] text-charcoal-400 mt-1.5 leading-snug">
            After this hour, today vanishes from the date strip and only
            tomorrow + later show.
          </p>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2 text-charcoal-700">
            <CalendarClock size={14} />
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Booking horizon
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              min={1}
              max={60}
              value={config.bookingHorizonDays}
              disabled={!canManage}
              onChange={(e) =>
                updateDeliveryScheduleConfig({
                  bookingHorizonDays: Number(e.target.value),
                })
              }
              className="input-base w-20 text-center tabular-nums disabled:opacity-60"
            />
            <span className="text-sm font-semibold text-charcoal-700">
              days ahead
            </span>
          </div>
          <p className="text-[11px] text-charcoal-400 mt-1.5 leading-snug">
            Furthest a customer can book — keep this realistic so vendors can
            plan supply.
          </p>
        </div>
      </div>

      <div className="card-base p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
            Days available for delivery
          </p>
          <p className="text-[10px] tabular-nums text-charcoal-400">
            {config.daysAvailable.length} / 7
          </p>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS_SHORT.map((label, idx) => {
            const on = config.daysAvailable.includes(idx);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(idx)}
                disabled={!canManage}
                className={`rounded-2xl px-2 py-2.5 text-[11px] font-bold transition border-2 ${
                  on
                    ? "bg-charcoal-800 border-charcoal-800 text-cream-50"
                    : "bg-white border-charcoal-100 text-charcoal-400 hover:border-charcoal-400"
                } disabled:cursor-not-allowed`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-charcoal-400 mt-2 leading-snug">
          Days you've toggled off won't appear in the customer date picker.
        </p>
      </div>

      <section className="mb-4">
        <div className="flex items-center justify-between mb-2 gap-3">
          <div className="min-w-0">
            <h3 className="display text-lg font-semibold">Delivery windows</h3>
            <p className="text-xs text-charcoal-400">
              Time blocks customers pick from. Capacity is per window, per day.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setEditingIsNew(true);
                setEditing(blank());
              }}
              className="btn-primary text-xs shrink-0"
            >
              <Plus size={12} /> Window
            </button>
          )}
        </div>
        <div className="space-y-2">
          {config.windows.map((w) => {
            const slot = getWindowAvailability(todayISO(), w, orders, config);
            return (
              <div
                key={w.id}
                className={`card-base p-3 ${!w.active ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`grid place-items-center w-11 h-11 rounded-2xl shrink-0 ${
                      w.active
                        ? "bg-mustard-400 text-charcoal-900"
                        : "bg-charcoal-100 text-charcoal-400"
                    }`}
                  >
                    <Clock4 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{w.label}</p>
                    <p className="text-xs text-charcoal-400 truncate">
                      {w.rangeLabel} · capacity {w.capacity}/day
                    </p>
                    <p className="text-[10px] text-charcoal-400 mt-0.5 tabular-nums">
                      Today: {slot.used}/{w.capacity} booked
                      {!slot.available && w.active && slot.reason
                        ? ` · ${slot.reason}`
                        : ""}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          upsertDeliveryWindow({ ...w, active: !w.active })
                        }
                        className={`grid place-items-center w-9 h-9 rounded-xl transition ${
                          w.active
                            ? "bg-cream-100 hover:bg-charcoal-100 text-charcoal-700"
                            : "bg-sage-300 hover:bg-sage-500 text-charcoal-900"
                        }`}
                        aria-label={
                          w.active ? "Pause window" : "Resume window"
                        }
                        title={w.active ? "Pause window" : "Resume window"}
                      >
                        {w.active ? <Pause size={13} /> : <Play size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIsNew(false);
                          setEditing(w);
                        }}
                        className="text-xs font-semibold underline px-2"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-4">
        <div className="flex items-center justify-between mb-2 gap-3">
          <div>
            <h3 className="display text-lg font-semibold">
              Capacity preview
            </h3>
            <p className="text-xs text-charcoal-400">
              Next 7 days — windows that hit capacity auto-hide from checkout.
            </p>
          </div>
          <Users size={14} className="text-charcoal-400 shrink-0" />
        </div>
        <div className="card-base p-4 space-y-3">
          {previewDates.map((d) => {
            const dayWindows = config.windows.map((w) => ({
              window: w,
              slot: getWindowAvailability(d.iso, w, orders, config),
            }));
            return (
              <div
                key={d.iso}
                className={`pb-3 border-b border-charcoal-100 last:border-b-0 last:pb-0 ${
                  !d.available ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold">
                    {d.label}
                    {d.isToday && (
                      <span className="ml-2 chip bg-mustard-400 text-charcoal-900 text-[9px]">
                        Today
                      </span>
                    )}
                  </p>
                  {!d.available && (
                    <span className="chip bg-clay-400/15 text-clay-600 text-[9px]">
                      {d.reason ?? "Closed"}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {dayWindows.map(({ window: w, slot }) => {
                    const pct =
                      w.capacity > 0
                        ? Math.min(100, (slot.used / w.capacity) * 100)
                        : 0;
                    const tone = !slot.available
                      ? "bg-clay-400/10 text-clay-600 border-clay-400/30"
                      : pct >= 80
                      ? "bg-mustard-100 text-mustard-700 border-mustard-400/40"
                      : "bg-sage-100 text-sage-700 border-sage-300/40";
                    return (
                      <div
                        key={w.id}
                        className={`rounded-2xl border px-2.5 py-2 ${tone}`}
                      >
                        <p className="text-[9px] uppercase tracking-wider font-bold opacity-80 truncate">
                          {w.label}
                        </p>
                        <p className="display text-sm font-bold tabular-nums leading-tight mt-0.5">
                          {slot.used}/{w.capacity}
                        </p>
                        <p className="text-[9px] mt-0.5 truncate opacity-80">
                          {slot.available
                            ? `${slot.remaining} left`
                            : slot.reason ?? "Closed"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {editing && (
        <WindowEditor
          windowItem={editing}
          isNew={editingIsNew}
          canDelete={!editingIsNew && config.windows.length > 1}
          onClose={() => setEditing(null)}
          onSave={(w) => {
            upsertDeliveryWindow(w);
            setEditing(null);
          }}
          onDelete={() => {
            removeDeliveryWindow(editing.id);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function WindowEditor({
  windowItem,
  isNew,
  canDelete,
  onClose,
  onSave,
  onDelete,
}: {
  windowItem: DeliveryWindow;
  isNew: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSave: (window: DeliveryWindow) => void;
  onDelete: () => void;
}) {
  const [w, setW] = useState<DeliveryWindow>(windowItem);
  const canSave =
    w.label.trim().length > 0 && w.endHour > w.startHour && w.capacity > 0;
  const autoRange = `${formatHour(w.startHour)} \u2013 ${formatHour(w.endHour)}`;
  const rangeLabelToShow = w.rangeLabel.trim() || autoRange;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal-900/50" onClick={onClose} />
      <div className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-full bg-charcoal-100 hover:bg-charcoal-200 text-charcoal-700"
          aria-label="Close"
        >
          <X size={14} />
        </button>
        <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700">
          {isNew ? "Create" : "Edit"}
        </p>
        <h3 className="display text-xl font-semibold leading-tight pr-9">
          {isNew ? "New delivery window" : w.label || "Edit window"}
        </h3>

        <div className="space-y-3 mt-4">
          <label className="block text-xs font-semibold text-charcoal-700">
            Window name <span className="text-clay-600">*</span>
            <input
              value={w.label}
              placeholder="e.g. Morning"
              onChange={(e) => setW({ ...w, label: e.target.value })}
              className="input-base mt-1"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-charcoal-700">
              Start hour
              <input
                type="number"
                min={0}
                max={23}
                value={w.startHour}
                onChange={(e) =>
                  setW({ ...w, startHour: Number(e.target.value) })
                }
                className="input-base mt-1 tabular-nums"
              />
              <span className="text-[11px] text-charcoal-400 font-normal block mt-0.5">
                {formatHour(w.startHour)}
              </span>
            </label>
            <label className="block text-xs font-semibold text-charcoal-700">
              End hour
              <input
                type="number"
                min={0}
                max={24}
                value={w.endHour}
                onChange={(e) =>
                  setW({ ...w, endHour: Number(e.target.value) })
                }
                className="input-base mt-1 tabular-nums"
              />
              <span className="text-[11px] text-charcoal-400 font-normal block mt-0.5">
                {formatHour(w.endHour)}
              </span>
            </label>
          </div>

          <label className="block text-xs font-semibold text-charcoal-700">
            Range label{" "}
            <span className="text-charcoal-400 font-normal">
              (shown to customer)
            </span>
            <input
              value={w.rangeLabel}
              placeholder={autoRange}
              onChange={(e) => setW({ ...w, rangeLabel: e.target.value })}
              className="input-base mt-1"
            />
            <span className="text-[11px] text-charcoal-400 font-normal block mt-0.5">
              Leave blank to auto-format:{" "}
              <span className="font-semibold text-charcoal-700">
                {rangeLabelToShow}
              </span>
            </span>
          </label>

          <label className="block text-xs font-semibold text-charcoal-700">
            Max deliveries per day <span className="text-clay-600">*</span>
            <input
              type="number"
              min={1}
              value={w.capacity}
              onChange={(e) =>
                setW({ ...w, capacity: Number(e.target.value) })
              }
              className="input-base mt-1 tabular-nums"
            />
            <span className="text-[11px] text-charcoal-400 font-normal block mt-0.5">
              When this window hits {Math.max(1, w.capacity)} orders for a day,
              it auto-hides from checkout.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold pt-2">
            <input
              type="checkbox"
              checked={w.active}
              onChange={(e) => setW({ ...w, active: e.target.checked })}
              className="w-4 h-4 accent-charcoal-800"
            />
            Window is active and accepting bookings
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => onSave(w)}
              disabled={!canSave}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNew ? "Create window" : "Save changes"}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
          </div>

          {canDelete && (
            <div className="mt-4 pt-4 border-t border-charcoal-100">
              <p className="text-[10px] uppercase tracking-wider font-bold text-clay-600 mb-1.5">
                Danger zone
              </p>
              <p className="text-[11px] text-charcoal-400 leading-snug mb-2">
                Existing bookings stay on their orders, but no new bookings
                will be possible.
              </p>
              <button
                type="button"
                onClick={onDelete}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl border border-clay-400 text-clay-600 hover:bg-clay-400 hover:text-cream-50 px-4 py-2.5 text-xs font-bold transition"
              >
                <Trash2 size={13} /> Delete window
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
