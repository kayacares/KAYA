import { useState } from "react";
import { AlertTriangle, Undo2, XCircle } from "lucide-react";
import type { Order } from "@/types";

export interface CancelOrderModalProps {
  order: Order;
  /** When true, surfaces the "Also process a refund" shortcut. */
  canRefund?: boolean;
  onClose: () => void;
  onConfirm: (data: {
    reason: string;
    notifyCustomer: boolean;
    alsoRefund: boolean;
  }) => void | Promise<void>;
}

/**
 * Replaces the legacy window.prompt cancel flow used in OrdersTab and
 * InvestigationsTab. Collects a required reason, an inform-customer
 * toggle, and (for Super Admins) a shortcut that opens the refund flow
 * with the same reason pre-filled.
 */
export default function CancelOrderModal({
  order,
  canRefund = false,
  onClose,
  onConfirm,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [alsoRefund, setAlsoRefund] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!reason.trim()) {
      setError("Please add a short reason for the audit log.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({
        reason: reason.trim(),
        notifyCustomer: notify,
        alsoRefund: canRefund && alsoRefund,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-charcoal-900/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-clay-400 text-cream-50 shrink-0">
            <XCircle size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-clay-600">
              Cancel order
            </p>
            <h3
              id="cancel-title"
              className="display text-xl font-semibold leading-tight"
            >
              Cancel order #{order.id.slice(-6).toUpperCase()}
            </h3>
            <p className="text-xs text-charcoal-400 mt-0.5">
              For {order.recipient.fullName.split(" ")[0]} · currently{" "}
              {order.status}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Cancellation reason · required
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-base min-h-[88px] resize-none"
              placeholder="e.g. Vendor out of stock, customer changed their mind, duplicate order…"
              maxLength={300}
              rows={3}
              autoFocus
            />
            <p className="text-[10px] text-charcoal-400 mt-1">
              Recorded in the audit log and saved to the order timeline.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-cream-100 px-3 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-charcoal-800"
            />
            <span className="flex-1">
              <span className="text-sm font-semibold block">
                Inform the customer
              </span>
              <span className="text-[11px] text-charcoal-400 leading-snug">
                Sends an in-app notification with the cancellation reason.
                Turn off for silent admin cleanup.
              </span>
            </span>
          </label>

          {canRefund && (
            <label className="flex items-start gap-3 rounded-2xl bg-mustard-100 border border-mustard-400/40 px-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoRefund}
                onChange={(e) => setAlsoRefund(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-charcoal-800"
              />
              <span className="flex-1">
                <span className="text-sm font-semibold block flex items-center gap-1.5">
                  <Undo2 size={12} className="text-mustard-700" />
                  Process a refund right after
                </span>
                <span className="text-[11px] text-charcoal-700 leading-snug">
                  Opens the refund flow with this reason pre-filled. You'll
                  choose full or partial there.
                </span>
              </span>
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-xs px-4 py-2"
            >
              {error}
            </p>
          )}

          {notify && (
            <p className="text-[10px] text-charcoal-400 flex items-start gap-1.5">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              <span>
                The customer will be notified that this order was cancelled.
              </span>
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-clay-400 hover:bg-clay-600 text-cream-50 text-sm font-bold py-3 transition disabled:opacity-60"
            >
              <XCircle size={14} />{" "}
              {submitting ? "Cancelling…" : "Cancel order"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-outline disabled:opacity-60"
            >
              Keep order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
