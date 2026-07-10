import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Heart,
  Layers,
  PackageCheck,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import type { OrderStatus } from "@/types";
import { relativeTime, cn } from "@/lib/utils";

interface AdminEventFeedProps {
  title?: string;
  subtitle?: string;
  filter?: OrderStatus[];
  limit?: number;
  emptyText?: string;
  className?: string;
}

const EVENT_CONFIG: Partial<
  Record<OrderStatus, { Icon: LucideIcon; accent: string; label: string }>
> = {
  Paid: {
    Icon: PackageCheck,
    accent: "bg-mustard-100 text-mustard-700",
    label: "Order paid",
  },
  "Assigned to Vendor": {
    Icon: Store,
    accent: "bg-sage-100 text-sage-700",
    label: "Vendor assigned",
  },
  "Being Prepared": {
    Icon: Layers,
    accent: "bg-cream-200 text-charcoal-700",
    label: "Being prepared",
  },
  "Out for Delivery": {
    Icon: Truck,
    accent: "bg-charcoal-800 text-cream-50",
    label: "Out for delivery",
  },
  Delivered: {
    Icon: PackageCheck,
    accent: "bg-mustard-400 text-charcoal-900",
    label: "Delivered",
  },
  Completed: {
    Icon: Heart,
    accent: "bg-sage-300 text-charcoal-900",
    label: "Recipient confirmed",
  },
  "Flagged for Investigation": {
    Icon: AlertTriangle,
    accent: "bg-clay-400 text-cream-50",
    label: "Delivery issue",
  },
  Cancelled: {
    Icon: XCircle,
    accent: "bg-clay-100 text-clay-600",
    label: "Cancelled",
  },
};

export default function AdminEventFeed({
  title = "Live ops feed",
  subtitle = "Latest order events across the pipeline",
  filter,
  limit = 6,
  emptyText = "No recent events. New activity will appear here automatically.",
  className,
}: AdminEventFeedProps) {
  const { orders } = useApp();

  const events = useMemo(() => {
    const items: {
      key: string;
      orderId: string;
      recipient: string;
      recipientEmoji: string;
      sender: string;
      city: string;
      status: OrderStatus;
      at: string;
    }[] = [];

    for (const o of orders) {
      o.history.forEach((h, i) => {
        if (!EVENT_CONFIG[h.status]) return;
        if (filter && !filter.includes(h.status)) return;
        items.push({
          key: `${o.id}_${i}`,
          orderId: o.id,
          recipient: o.recipient.fullName,
          recipientEmoji: o.recipient.emoji,
          sender: o.senderName,
          city: o.recipient.city,
          status: h.status,
          at: h.at,
        });
      });
    }

    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);
  }, [orders, filter, limit]);

  return (
    <section
      className={cn(
        "card-base p-4 bg-charcoal-900 text-cream-50 border-charcoal-700",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-mustard-400 animate-pulse" />
            {title}
          </p>
          <p className="text-xs text-cream-100/70 mt-1 leading-snug">
            {subtitle}
          </p>
        </div>
        {events.length > 0 && (
          <span className="chip bg-cream-50/10 text-cream-50 text-[10px] shrink-0">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        )}
      </header>

      {events.length === 0 ? (
        <p className="text-xs text-cream-100/70 py-4 text-center leading-relaxed">
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-cream-50/10">
          {events.map((e) => {
            const cfg = EVENT_CONFIG[e.status]!;
            const { Icon, accent, label } = cfg;
            return (
              <li key={e.key}>
                <Link
                  to={`/orders/${e.orderId}`}
                  className="flex items-start gap-3 py-2.5 -mx-2 px-2 rounded-2xl hover:bg-cream-50/10 transition"
                >
                  <span
                    className={cn(
                      "grid place-items-center w-9 h-9 rounded-2xl shrink-0",
                      accent
                    )}
                    aria-hidden
                  >
                    <Icon size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-cream-50 leading-tight">
                      {label}{" "}
                      <span className="text-cream-100/60 font-medium">
                        · #{e.orderId.slice(-6).toUpperCase()}
                      </span>
                    </p>
                    <p className="text-[11px] text-cream-100/70 mt-0.5 truncate">
                      <span className="mr-1">{e.recipientEmoji}</span>
                      {e.recipient} · {e.city} · from {e.sender}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-cream-100/60 font-semibold shrink-0 mt-0.5">
                    {relativeTime(e.at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
