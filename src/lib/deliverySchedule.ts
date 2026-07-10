import type {
  DeliveryScheduleConfig,
  DeliveryWindow,
  Order,
} from "@/types";

/**
 * Default schedule used the very first time KAYA boots — sensible
 * launch-day windows aligned with how Ghana grocery delivery actually
 * runs. Super Admins can override any of this from the Admin → Schedule
 * tab, and the live config is persisted in localStorage.
 */
export const DEFAULT_DELIVERY_SCHEDULE_CONFIG: DeliveryScheduleConfig = {
  windows: [
    {
      id: "morning",
      label: "Morning",
      rangeLabel: "8:00 AM \u2013 12:00 PM",
      startHour: 8,
      endHour: 12,
      active: true,
      capacity: 20,
    },
    {
      id: "afternoon",
      label: "Afternoon",
      rangeLabel: "12:00 PM \u2013 4:00 PM",
      startHour: 12,
      endHour: 16,
      active: true,
      capacity: 20,
    },
    {
      id: "evening",
      label: "Evening",
      rangeLabel: "4:00 PM \u2013 8:00 PM",
      startHour: 16,
      endHour: 20,
      active: true,
      capacity: 15,
    },
  ],
  sameDayCutoffHour: 14,
  daysAvailable: [1, 2, 3, 4, 5, 6],
  bookingHorizonDays: 14,
};

export const DAY_LABELS_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];
export const DAY_LABELS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function addDaysISO(baseISO: string, days: number): string {
  const d = parseDateISO(baseISO);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Human-friendly date label used across checkout and the order detail
 * page. Today / Tomorrow on near dates, otherwise weekday + month/day.
 */
export function formatScheduledDate(
  dateISO: string,
  now: Date = new Date()
): string {
  const date = parseDateISO(dateISO);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Convert an hour (0-23) to a 12-hour clock label, e.g. 14 → "2:00 PM". */
export function formatHour(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}

export interface WindowAvailability {
  available: boolean;
  capacity: number;
  used: number;
  remaining: number;
  reason?: string;
}

/**
 * Single source of truth for whether a customer can pick a given
 * (date × window) slot at checkout. Mirrors the rules surfaced in the
 * admin Schedule tab: window must be active, the date must be a
 * delivery day, same-day requests have to respect the cutoff hour,
 * and the window can't already be at capacity.
 */
export function getWindowAvailability(
  dateISO: string,
  windowItem: DeliveryWindow,
  orders: Order[],
  config: DeliveryScheduleConfig,
  now: Date = new Date()
): WindowAvailability {
  const used = orders.filter(
    (o) =>
      o.deliverySchedule?.date === dateISO &&
      o.deliverySchedule?.windowId === windowItem.id &&
      o.status !== "Cancelled"
  ).length;
  const remaining = Math.max(0, windowItem.capacity - used);
  const base = { capacity: windowItem.capacity, used, remaining };

  if (!windowItem.active) {
    return { ...base, available: false, reason: "Window paused by Ops" };
  }

  const target = parseDateISO(dateISO);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (target < today) {
    return { ...base, available: false, reason: "Date in the past" };
  }

  if (!config.daysAvailable.includes(target.getDay())) {
    return { ...base, available: false, reason: "Not a delivery day" };
  }

  if (sameDay(target, now)) {
    if (now.getHours() >= config.sameDayCutoffHour) {
      return {
        ...base,
        available: false,
        reason: `Past ${formatHour(config.sameDayCutoffHour)} cutoff`,
      };
    }
    if (now.getHours() >= windowItem.startHour) {
      return {
        ...base,
        available: false,
        reason: "Window already started",
      };
    }
  }

  if (remaining <= 0) {
    return { ...base, available: false, reason: "Fully booked" };
  }

  return { ...base, available: true };
}

export interface DateOption {
  iso: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  dayOfWeek: number;
  available: boolean;
  reason?: string;
}

/**
 * Build the date strip surfaced in checkout — every date in the
 * booking horizon, each annotated with whether at least one delivery
 * window is currently bookable.
 */
export function getAvailableDates(
  config: DeliveryScheduleConfig,
  orders: Order[],
  now: Date = new Date()
): DateOption[] {
  const result: DateOption[] = [];
  const todayDate = new Date(now);
  todayDate.setHours(0, 0, 0, 0);

  const horizon = Math.max(1, config.bookingHorizonDays);
  for (let i = 0; i < horizon; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + i);
    const iso = todayISO(d);
    const dow = d.getDay();
    const label = formatScheduledDate(iso, now);
    const base = {
      iso,
      label,
      isToday: i === 0,
      isTomorrow: i === 1,
      dayOfWeek: dow,
    };

    if (!config.daysAvailable.includes(dow)) {
      result.push({ ...base, available: false, reason: "Not a delivery day" });
      continue;
    }

    const anyAvailable = config.windows.some(
      (w) => getWindowAvailability(iso, w, orders, config, now).available
    );

    result.push({
      ...base,
      available: anyAvailable,
      reason: anyAvailable
        ? undefined
        : i === 0
        ? "Past today's cutoff or fully booked"
        : "Fully booked",
    });
  }
  return result;
}
