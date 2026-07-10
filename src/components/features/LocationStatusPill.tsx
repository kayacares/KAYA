import { AlertTriangle, CheckCircle2, Clock, Send } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import type { Order } from "@/types";

interface Props {
  order: Order;
}

/**
 * Compact status pill for the admin OrdersTab list. Mirrors the
 * effective state computed in <LocationConfirmationCard/> so ops
 * can triage at-a-glance without opening every order:
 *
 *   emerald  → Location verified (via profile OR submission)
 *   mustard  → Pending recipient confirmation (link sent)
 *   cream    → Not requested yet (order came in, no link created)
 *   clay     → Needs follow-up (ops has flagged it)
 */
export default function LocationStatusPill({ order }: Props) {
  const { locationConfirmations } = useApp();
  const recipient = order.recipient;
  const preVerified =
    typeof recipient.latitude === "number" &&
    typeof recipient.longitude === "number";
  const confirmation = locationConfirmations.find(
    (c) => c.orderId === order.id
  );

  if (confirmation?.status === "verified" || preVerified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <CheckCircle2 size={9} /> Location verified
      </span>
    );
  }

  if (confirmation?.status === "needs_followup") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-clay-400 text-cream-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <AlertTriangle size={9} /> Needs follow-up
      </span>
    );
  }

  if (confirmation) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-mustard-100 text-mustard-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <Clock size={9} /> Pending recipient
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 text-charcoal-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <Send size={9} /> No location link yet
    </span>
  );
}
