import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock4,
  MapPin,
  Phone,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import {
  addDaysISO,
  formatScheduledDate,
  todayISO,
} from "@/lib/deliverySchedule";
import StatusBadge from "@/components/features/StatusBadge";
import type {
  DeliveryWindow,
  Order,
  OrderStatus,
  Vendor,
} from "@/types";

const ACTIVE_STATUSES = new Set<OrderStatus>([
  "Pending",
  "Paid",
  "Assigned to Vendor",
  "Being Prepared",
  "Out for Delivery",
  "Delivered",
  "Flagged for Investigation",
  "Needs Attention",
]);

/**
 * Daily delivery schedule view embedded at the top of OrdersTab. Ops,
 * Manager and Super Admin all see the same view (it's gated by
 * `orders.view` via the parent tab) so any staff member landing on
 * Orders can instantly plan routes by time block. Date selector lets
 * them flip between Today, Tomorrow, and any date within the booking
 * horizon — capacity bars per window auto-tone (sage → mustard → clay)
 * as bookings fill up, and tapping a booking jumps to the order detail.
 */
export default function DailyScheduleView() {
  const { orders, deliveryScheduleConfig: config, vendors } = useApp();
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const horizon = addDaysISO(
    today,
    Math.max(0, config.bookingHorizonDays - 1)
  );

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [customOpen, setCustomOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const dayOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.deliverySchedule?.date === selectedDate &&
          ACTIVE_STATUSES.has(o.status)
      ),
    [orders, selectedDate]
  );

  const windowGroups = useMemo(
    () =>
      config.windows.map((w) => {
        const list = dayOrders.filter(
          (o) => o.deliverySchedule?.windowId === w.id
        );
        const used = list.length;
        const pct =
          w.capacity > 0 ? Math.min(100, (used / w.capacity) * 100) : 0;
        const remaining = Math.max(0, w.capacity - used);
        return { window: w, list, used, remaining, pct };
      }),
    [config.windows, dayOrders]
  );

  const totalCapacity = config.windows.reduce(
    (s, w) => s + (w.active ? w.capacity : 0),
    0
  );
  const fullyBookedCount = windowGroups.filter(
    (g) => g.window.active && g.remaining === 0
  ).length;

  const isToday = selectedDate === today;

  return (
    <section className="card-base border-charcoal-100 mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <span className="grid place-items-center w-11 h-11 rounded-2xl bg-charcoal-800 text-mustard-400 shrink-0">
          <CalendarClock size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Daily delivery schedule
            </p>
            {isToday && (
              <span className="chip bg-mustard-100 text-mustard-700 text-[9px]">
                Today
              </span>
            )}
            {fullyBookedCount > 0 && (
              <span className="chip bg-clay-400/15 text-clay-600 text-[9px]">
                {fullyBookedCount} window
                {fullyBookedCount === 1 ? "" : "s"} full
              </span>
            )}
          </div>
          <h3 className="display text-lg font-semibold leading-tight mt-0.5 truncate">
            {formatScheduledDate(selectedDate)} \u00b7 {dayOrders.length} of{" "}
            {totalCapacity} bookings
          </h3>
          <p className="text-[11px] text-charcoal-400 mt-0.5">
            Tap a booking to open the order. Pause windows in the Schedule
            tab.
          </p>
        </div>
        <span className="grid place-items-center w-9 h-9 rounded-full bg-cream-100 text-charcoal-700 shrink-0">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 border-t border-charcoal-100 pt-4">
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-3">
            <DateChip
              label="Today"
              active={selectedDate === today && !customOpen}
              onClick={() => {
                setSelectedDate(today);
                setCustomOpen(false);
              }}
            />
            <DateChip
              label="Tomorrow"
              active={selectedDate === tomorrow && !customOpen}
              onClick={() => {
                setSelectedDate(tomorrow);
                setCustomOpen(false);
              }}
            />
            <DateChip
              label={
                customOpen ? formatScheduledDate(selectedDate) : "Pick a date"
              }
              active={customOpen}
              onClick={() => setCustomOpen(true)}
            />
          </div>
          {customOpen && (
            <input
              type="date"
              value={selectedDate}
              min={today}
              max={horizon}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-base mb-4 text-sm"
            />
          )}

          {windowGroups.length === 0 ? (
            <div className="rounded-2xl bg-cream-100 px-4 py-6 text-center text-sm text-charcoal-400">
              No delivery windows configured. A Super Admin can add windows in
              the Schedule tab.
            </div>
          ) : (
            <div className="space-y-3">
              {windowGroups.map((group) => (
                <WindowGroup
                  key={group.window.id}
                  window={group.window}
                  list={group.list}
                  used={group.used}
                  remaining={group.remaining}
                  pct={group.pct}
                  vendors={vendors}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DateChip({
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
      type="button"
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

function WindowGroup({
  window: w,
  list,
  used,
  remaining,
  pct,
  vendors,
}: {
  window: DeliveryWindow;
  list: Order[];
  used: number;
  remaining: number;
  pct: number;
  vendors: Vendor[];
}) {
  const isPaused = !w.active;
  const tone = isPaused
    ? "bg-charcoal-100 border-charcoal-200"
    : remaining === 0
    ? "bg-clay-400/10 border-clay-400/30"
    : pct >= 80
    ? "bg-mustard-100 border-mustard-400/40"
    : "bg-sage-100 border-sage-300/40";
  const barTone = isPaused
    ? "bg-charcoal-400"
    : remaining === 0
    ? "bg-clay-400"
    : pct >= 80
    ? "bg-mustard-400"
    : "bg-sage-500";
  const statusLabel = isPaused
    ? "Paused"
    : remaining === 0
    ? "Fully booked"
    : `${remaining} left`;

  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="grid place-items-center w-10 h-10 rounded-xl bg-white shrink-0">
          <Clock4 size={14} className="text-charcoal-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight flex items-center gap-2 flex-wrap">
            {w.label}
            {isPaused && (
              <span className="chip bg-charcoal-200 text-charcoal-700 text-[9px]">
                Paused
              </span>
            )}
          </p>
          <p className="text-[11px] text-charcoal-400 truncate">
            {w.rangeLabel}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="display font-bold text-lg tabular-nums leading-none">
            {used}/{w.capacity}
          </p>
          <p className="text-[10px] text-charcoal-400 mt-0.5">{statusLabel}</p>
        </div>
      </div>

      <div className="h-1.5 bg-white rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all ${barTone}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {list.length === 0 ? (
        <p className="text-[11px] text-charcoal-400 text-center py-3 italic">
          No bookings yet for this window.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((o) => {
            const vendor = vendors.find((v) => v.id === o.vendorId);
            const contactFirst =
              o.deliverySchedule?.recipientAvailable === "contact_first";
            return (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="block bg-white rounded-xl px-3 py-2.5 hover:shadow-soft transition"
              >
                <div className="flex items-center gap-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
                        #{o.id.slice(-6).toUpperCase()}
                      </span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-sm font-semibold mt-0.5 truncate">
                      {o.recipient.emoji} {o.recipient.fullName}
                    </p>
                    <p className="text-[11px] text-charcoal-400 truncate flex items-center gap-1">
                      <MapPin size={9} className="shrink-0" />
                      <span className="truncate">
                        {o.recipient.townArea ?? o.recipient.city}
                        {vendor ? ` \u00b7 ${vendor.name}` : ""}
                      </span>
                    </p>
                    {contactFirst && (
                      <p className="text-[10px] text-mustard-700 font-semibold mt-1 inline-flex items-center gap-1">
                        <Phone size={9} />
                        Call before delivery
                      </p>
                    )}
                  </div>
                  <p className="display font-bold tabular-nums text-sm shrink-0">
                    {formatGHS(o.totalGHS)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
