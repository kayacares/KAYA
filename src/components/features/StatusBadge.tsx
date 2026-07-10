import type { OrderStatus } from "@/types";

/**
 * Order-status pill.
 *
 * Post-2026 refresh: positive fulfillment states (Assigned →
 * Being Prepared → Out for Delivery → Delivered → Completed) now
 * use KAYA's emerald accent so the customer's eye immediately
 * reads "care is on the way / delivered" across the app. Paid
 * stays mustard as it sits between payment and fulfillment;
 * problem states (Needs Attention, Flagged, Cancelled) keep their
 * warm/dark treatments so they stand out against the emerald
 * flow.
 */
const styles: Record<OrderStatus, string> = {
  "Pending": "bg-cream-200 text-charcoal-700",
  "Paid": "bg-mustard-100 text-mustard-700",
  "Assigned to Vendor": "bg-emerald-100 text-emerald-700",
  "Being Prepared": "bg-emerald-200 text-emerald-700",
  "Out for Delivery": "bg-emerald-500 text-cream-50",
  "Delivered": "bg-emerald-600 text-cream-50",
  "Completed": "bg-emerald-700 text-cream-50",
  "Flagged for Investigation": "bg-clay-400 text-cream-50",
  "Needs Attention": "bg-mustard-400 text-charcoal-900",
  "Cancelled": "bg-charcoal-700 text-cream-50",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const cls = styles[status] ?? "bg-charcoal-100 text-charcoal-700";
  return (
    <span className={`chip ${cls} text-[10px] uppercase tracking-wide`}>
      {status}
    </span>
  );
}
