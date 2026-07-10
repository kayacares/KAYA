
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatGHS } from "@/lib/currency";
import { relativeTime } from "@/lib/utils";
import { can } from "@/lib/permissions";
import StatusBadge from "@/components/features/StatusBadge";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Phone,
  Replace,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import ImageUpload from "@/components/features/ImageUpload";
import SupportButton from "@/components/features/SupportButton";
import CancelOrderModal from "@/components/features/CancelOrderModal";
import LocationConfirmationCard from "@/components/features/LocationConfirmationCard";
import { formatScheduledDate } from "@/lib/deliverySchedule";
import type { Order } from "@/types";

const STEPS = [
  "Paid",
  "Assigned to Vendor",
  "Being Prepared",
  "Out for Delivery",
  "Delivered",
  "Completed",
] as const;

const ACTIVE_STATUSES = new Set([
  "Pending",
  "Paid",
  "Assigned to Vendor",
  "Being Prepared",
  "Out for Delivery",
  "Delivered",
  "Flagged for Investigation",
  "Needs Attention",
]);

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get("new") === "1";
  const {
    orders,
    user,
    shops,
    products,
    setRecipientConfirm,
    addToCart,
    setDeliveryPhoto,
    cancelOrder,
    refundOrder,
    approveSubstitution,
  } = useApp();
  const isStaff = !!user?.role && user.role !== "customer";
  const canCancel = can("orders.cancel", user);
  const canRefund = can("orders.refund", user);
  const order = orders.find((o) => o.id === id);
  const [showCelebrate, setShowCelebrate] = useState(isNew);
  const [showRefund, setShowRefund] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [initialRefundReason, setInitialRefundReason] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => setShowCelebrate(false), 3500);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  // Handle "Also refund" handoff from OrdersTab / InvestigationsTab.
  useEffect(() => {
    const state = location.state as { openRefundWith?: string } | null;
    if (state?.openRefundWith) {
      setInitialRefundReason(state.openRefundWith);
      setShowRefund(true);
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: null,
      });
    }
  }, [location.pathname, location.search, location.state, navigate]); // Added missing dependencies

  const stepIndex = useMemo(() => {
    if (!order) return -1;
    return STEPS.indexOf(order.status as any);
  }, [order]);

  if (!order) {
    return (
      <>
        <TopBar back title="Order" />
        <main className="container-app px-4">
          <p>Order not found.</p>
        </main>
      </>
    );
  }

  const shop = shops.find((s) => s.id === order.shopId);
  const currency = user?.currency ?? order.senderCurrency;
  const refunded = order.refundAmountGHS ?? 0;
  const isRefunded = refunded > 0;
  const fullyRefunded = isRefunded && refunded >= order.totalGHS;
  const isActive = ACTIVE_STATUSES.has(order.status);
  const canCancelThisOrder = canCancel && isActive;

  const reorder = () => {
    for (const it of order.items) addToCart(it.productId, it.quantity);
  };

  return (
    <>
      <TopBar back title={`Order ${order.id.slice(-6).toUpperCase()}`} />
      <main className="container-app px-4 pb-10">
        {showCelebrate && (
          <div className="card-base bg-sage-500 text-cream-50 border-sage-500 p-5 mb-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <Sparkles className="text-mustard-400" />
              <div>
                <p className="display text-xl font-semibold">
                  Care is on the way!
                </p>
                <p className="text-sm text-cream-100/90">
                  We'll keep {order.recipient.fullName.split(" ")[0]} updated.
                </p>
              </div>
            </div>
          </div>
        )}

        {order.status === "Cancelled" && (
          <div className="card-base bg-charcoal-800 text-cream-50 border-charcoal-700 p-5 mb-4">
            <p className="display text-xl font-semibold flex items-center gap-2">
              <XCircle className="text-clay-400" /> Order cancelled
            </p>
            <p className="text-sm text-cream-100/80 mt-1">
              {order.cancellationReason
                ? order.cancellationReason
                : "This order was cancelled. Reach out to KAYA support for a refund."}
            </p>
            {isRefunded && (
              <div className="mt-3 rounded-2xl bg-cream-50/10 px-3 py-2 text-sm flex items-start gap-2">
                <Undo2
                  size={14}
                  className="text-mustard-400 shrink-0 mt-0.5"
                />
                <span>
                  <span className="font-semibold">
                    {fullyRefunded ? "Full refund" : "Partial refund"}:
                  </span>{" "}
                  {formatCurrency(refunded, currency)}
                  {!fullyRefunded && (
                    <span className="text-cream-100/60">
                      {" "}
                      of {formatCurrency(order.totalGHS, currency)}
                    </span>
                  )}
                  {order.refundedAt && (
                    <span className="text-cream-100/60">
                      {" "}
                      · {relativeTime(order.refundedAt)}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {order.status === "Flagged for Investigation" && (
          <div className="card-base bg-clay-400 text-cream-50 border-clay-600 p-5 mb-4">
            <p className="display text-xl font-semibold flex items-center gap-2">
              <AlertTriangle className="text-mustard-400" /> We're looking into this
            </p>
            <p className="text-sm text-cream-50/90 mt-1">
              {order.recipient.fullName.split(" ")[0]} reported a problem.
              KAYA ops is investigating — we'll update you shortly.
            </p>
          </div>
        )}

        {order.status === "Needs Attention" && (() => {
          const pending = order.substitutions?.find(
            (s) => s.id === order.pendingSubstitutionId
          );
          return (
            <div className="card-base bg-mustard-100 border-mustard-400/60 p-5 mb-4">
              <p className="display text-xl font-semibold flex items-center gap-2 text-charcoal-900">
                <AlertTriangle className="text-mustard-700" /> Needs your
                attention
              </p>
              <p className="text-sm text-charcoal-700 mt-1 leading-relaxed">
                {order.needsAttentionReason ??
                  "An item in this order needs your input before we can continue."}
              </p>
              {pending && (
                <div className="mt-3 rounded-2xl bg-white border border-mustard-400/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
                    Substitution proposal
                  </p>
                  <p className="text-sm font-semibold mt-1">
                    {pending.originalProductName}{" "}
                    <span className="text-charcoal-400 font-normal">→</span>{" "}
                    {pending.replacementProductName ?? "(remove item)"}
                  </p>
                  <p className="text-[11px] text-charcoal-400 mt-1 leading-snug">
                    {pending.reason}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        approveSubstitution(order.id, pending.id, true)
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-sage-500 hover:bg-sage-700 text-cream-50 text-xs font-bold py-2 transition"
                    >
                      <Check size={13} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        approveSubstitution(order.id, pending.id, false)
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-charcoal-800 hover:bg-charcoal-900 text-cream-50 text-xs font-bold py-2 transition"
                    >
                      <X size={13} /> Decline & remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Hero */}
        <section className="card-base p-5 mb-4 bg-charcoal-800 text-cream-50 border-charcoal-700">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="grid place-items-center w-14 h-14 rounded-2xl bg-mustard-400 text-charcoal-900 text-2xl">
                {order.recipient.emoji}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-mustard-400 font-semibold">
                  For
                </div>
                <p className="display text-xl font-semibold leading-tight">
                  {order.recipient.fullName}
                </p>
                <p className="text-xs text-cream-100/70">
                  {order.recipient.city} · {shop?.name}
                </p>
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>

          {/* Tracker */}
          <div className="mt-5">
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      i <= stepIndex ? "bg-mustard-400" : "bg-cream-50/15"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-1 mt-2 text-[10px] uppercase tracking-wider text-cream-100/70">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={`truncate ${i <= stepIndex ? "text-mustard-400" : ""}`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Recipient confirm */}
        {order.status === "Delivered" && !order.recipientConfirmed && (
          <section className="card-base p-5 mb-4 bg-mustard-100 border-mustard-400">
            <p className="text-sm font-semibold">
              {order.recipient.fullName.split(" ")[0]} should have received this.
            </p>
            <p className="text-xs text-charcoal-700 mt-1">
              Simulating the SMS/WhatsApp confirmation:
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setRecipientConfirm(order.id, "yes")}
                className="btn-primary flex-1"
              >
                <CheckCircle2 size={16} /> Yes, received
              </button>
              <button
                onClick={() => setRecipientConfirm(order.id, "no")}
                className="btn-outline flex-1"
              >
                <XCircle size={16} /> Not yet
              </button>
            </div>
          </section>
        )}

        {/* Items */}
        <section className="card-base p-4 mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-400 mb-3">
            What's being sent
          </h3>
          <div className="divide-y divide-charcoal-100">
            {order.items.map((it) => {
              const product = products.find((p) => p.id === it.productId);
              const warranty = product?.warrantyMonths ?? 0;
              return (
                <div
                  key={it.productId}
                  className="py-2.5 flex justify-between text-sm gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {it.name}{" "}
                      <span className="text-charcoal-400">× {it.quantity}</span>
                    </p>
                    {warranty > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] uppercase tracking-wider font-semibold text-sage-700">
                        <ShieldCheck size={10} /> {warranty}-month warranty
                      </span>
                    )}
                  </div>
                  <span className="font-semibold whitespace-nowrap">
                    {formatCurrency(it.priceGHS * it.quantity, currency)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-charcoal-100 pt-3 mt-2 text-sm space-y-1">
            <div className="flex justify-between text-charcoal-400">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotalGHS, currency)}</span>
            </div>
            <div className="flex justify-between text-charcoal-400">
              <span>Delivery</span>
              <span>{formatCurrency(order.deliveryFeeGHS, currency)}</span>
            </div>
            <div className="flex justify-between display font-bold pt-1">
              <span>Total</span>
              <span>{formatCurrency(order.totalGHS, currency)}</span>
            </div>
          </div>
        </section>

        {/* Substitution preference */}
        {order.substitutionPreference && (
          <section className="card-base p-4 mb-4 bg-cream-100 border-charcoal-100">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white text-charcoal-700 shrink-0">
                <Replace size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
                  Substitution preference
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {order.substitutionPreference === "allow"
                    ? "Allow similar substitutions"
                    : order.substitutionPreference === "contact_first"
                    ? "Contact me before substituting"
                    : "Remove unavailable items"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Substitution history */}
        {(order.substitutions?.length ?? 0) > 0 && (
          <section className="card-base p-4 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-400 mb-3 flex items-center gap-2">
              <Replace size={13} /> Substitutions
            </h3>
            <ul className="space-y-3">
              {(order.substitutions ?? []).map((s) => {
                const label =
                  s.action === "substituted"
                    ? `${s.originalProductName} → ${s.replacementProductName ?? ""}`
                    : s.action === "removed"
                    ? `Removed: ${s.originalProductName}`
                    : s.action === "approval_pending"
                    ? `Awaiting approval: ${s.originalProductName}`
                    : s.action === "approved"
                    ? `Approved: ${s.originalProductName} → ${s.replacementProductName ?? "(removed)"}`
                    : `Declined: ${s.originalProductName}`;
                return (
                  <li key={s.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1 w-2 h-2 rounded-full bg-mustard-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{label}</p>
                      <p className="text-[11px] text-charcoal-400 leading-snug mt-0.5">
                        {s.reason} · by {s.actorName} ·{" "}
                        {relativeTime(s.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Recipient location confirmation — rendered before the
            delivery-details block so both senders and ops see the
            exact-location status the moment they open the order. */}
        <LocationConfirmationCard order={order} isStaff={isStaff} />

        {/* Delivery details */}
        <section className="card-base p-4 mb-4 space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-400">
            Delivery details
          </h3>
          {order.deliverySchedule && (
            <div className="flex items-start gap-3 bg-cream-100 rounded-2xl p-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-mustard-400 text-charcoal-900 shrink-0">
                <CalendarClock size={15} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
                  Scheduled delivery
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {formatScheduledDate(order.deliverySchedule.date)} ·{" "}
                  {order.deliverySchedule.windowLabel}
                </p>
                <p className="text-[11px] text-charcoal-400 mt-0.5">
                  {order.deliverySchedule.windowRangeLabel}
                  {order.deliverySchedule.recipientAvailable ===
                    "contact_first" && (
                    <span> · contact recipient before delivery</span>
                  )}
                </p>
                {order.deliverySchedule.specialInstructions && (
                  <p className="text-[11px] text-charcoal-700 mt-1 italic leading-snug">
                    “{order.deliverySchedule.specialInstructions}”
                  </p>
                )}
              </div>
            </div>
          )}
          <p className="text-sm">
            {order.recipient.address}, {order.recipient.city}
          </p>
          <a
            href={`tel:${order.recipient.phone}`}
            className="text-sm text-sage-700 inline-flex items-center gap-1.5 font-medium"
          >
            <Phone size={13} /> {order.recipient.phone}
          </a>
          {order.message && order.shopId === "gift" && (
              <div className="mt-2 p-3 rounded-2xl bg-cream-100">
                <p className="text-[11px] uppercase tracking-wider text-charcoal-400 font-semibold flex items-center gap-1">
                  <MessageSquare size={11} /> Personal note
                </p>
                <p className="text-sm mt-1 italic">"{order.message}"</p>
              </div>
            )}
          {isStaff ? (
            <div className="mt-2">
              <p className="text-[11px] uppercase tracking-wider text-charcoal-400 font-semibold flex items-center gap-1 mb-2">
                <Camera size={11} /> Delivery proof
              </p>
              <ImageUpload
                value={order.deliveryPhoto || ""}
                onChange={(url) => setDeliveryPhoto(order.id, url)}
                bucket="delivery-photos"
                folder={`orders/${order.id}`}
                aspect="video"
                hint="JPG or PNG · proof of delivery for the recipient"
              />
            </div>
          ) : order.deliveryPhoto ? (
            <div className="mt-2">
              <p className="text-[11px] uppercase tracking-wider text-charcoal-400 font-semibold flex items-center gap-1">
                <Camera size={11} /> Delivery photo
              </p>
              <img
                src={order.deliveryPhoto}
                alt="Delivery"
                className="mt-2 rounded-2xl w-full max-h-72 object-cover"
              />
            </div>
          ) : null}
        </section>

        {/* Timeline */}
        <section className="card-base p-4 mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-400 mb-3">
            Activity
          </h3>
          <ul className="space-y-3">
            {order.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-1 w-2 h-2 rounded-full bg-mustard-400 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{h.status}</p>
                  <p className="text-xs text-charcoal-400">
                    {relativeTime(h.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Admin: Cancel action */}
        {canCancelThisOrder && (
          <section className="card-base p-4 mb-4 border-charcoal-100 bg-cream-100">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-charcoal-800 text-cream-50 shrink-0">
                <Ban size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-700 mb-0.5">
                  Admin action
                </p>
                <h3 className="display text-lg font-semibold">
                  Cancel this order
                </h3>
                <p className="text-xs text-charcoal-400 mt-0.5 leading-snug">
                  Stops fulfilment immediately and notifies the customer by
                  default. Use the refund flow afterward to return funds.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCancel(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-charcoal-800 hover:bg-charcoal-900 text-cream-50 text-xs font-bold px-4 py-2 transition"
                >
                  <XCircle size={13} /> Open cancel modal
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Super Admin: Refund action */}
        {canRefund && !fullyRefunded && (
          <section className="card-base p-4 mb-4 border-clay-400/40 bg-clay-400/5">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-clay-400 text-cream-50 shrink-0">
                <ShieldAlert size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-clay-600 mb-0.5">
                  Super Admin action
                </p>
                <h3 className="display text-lg font-semibold">
                  {isRefunded ? "Issue additional refund" : "Issue refund"}
                </h3>
                <p className="text-xs text-charcoal-400 mt-0.5 leading-snug">
                  {isRefunded
                    ? `Already refunded ${formatGHS(
                        refunded
                      )} of ${formatGHS(order.totalGHS)}. You can process the remaining ${formatGHS(
                        order.totalGHS - refunded
                      )}.`
                    : `Process a full or partial refund up to ${formatGHS(
                        order.totalGHS
                      )}.${
                        order.stripePaymentIntentId
                          ? " Funds return through Stripe."
                          : " Local-only \u2014 no Stripe charge to reverse."
                      }`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInitialRefundReason("");
                    setShowRefund(true);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-clay-400 hover:bg-clay-600 text-cream-50 text-xs font-bold px-4 py-2 transition"
                >
                  <Undo2 size={13} /> Open refund modal
                </button>
              </div>
            </div>
          </section>
        )}

        <SupportButton
          variant="card"
          orderId={order.id}
          orderStatus={order.status}
          recipientName={order.recipient.fullName}
          className="mb-4"
        />

        <div className="flex gap-2">
          <Link to="/" className="btn-outline flex-1">
            Back home
          </Link>
          <Link to="/cart" onClick={reorder} className="btn-primary flex-1">
            <RotateCw size={14} /> Reorder
          </Link>
        </div>
      </main>

      {showCancel && (
        <CancelOrderModal
          order={order}
          canRefund={canRefund}
          onClose={() => setShowCancel(false)}
          onConfirm={({ reason, notifyCustomer, alsoRefund }) => {
            cancelOrder(order.id, reason, { notifyCustomer });
            setShowCancel(false);
            if (alsoRefund) {
              setInitialRefundReason(reason);
              setShowRefund(true);
            }
          }}
        />
      )}

      {showRefund && (
        <RefundModal
          order={order}
          initialReason={initialRefundReason}
          onClose={() => {
            setShowRefund(false);
            setInitialRefundReason("");
          }}
          onConfirm={async ({ amountGHS, reason, notifyCustomer }) => {
            const result = await refundOrder(order.id, reason, {
              amountGHS,
              notifyCustomer,
            });
            if (result.ok) {
              setShowRefund(false);
              setInitialRefundReason("");
            }
          }}
        />
      )}
    </>
  );
}

function RefundModal({
  order,
  initialReason,
  onClose,
  onConfirm,
}: {
  order: Order;
  initialReason?: string;
  onClose: () => void;
  onConfirm: (data: {
    amountGHS: number;
    reason: string;
    notifyCustomer: boolean;
  }) => Promise<void> | void;
}) {
  const alreadyRefunded = order.refundAmountGHS ?? 0;
  const maxRefund = Math.max(0, order.totalGHS - alreadyRefunded);
  const [fullAmount, setFullAmount] = useState(true);
  const [amountStr, setAmountStr] = useState(maxRefund.toFixed(2));
  const [reason, setReason] = useState(initialReason ?? "");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = fullAmount ? maxRefund : Number(amountStr);
  const safeAmount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const isStripeBacked = !!order.stripePaymentIntentId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Refund amount must be greater than zero.");
      return;
    }
    if (parsedAmount > maxRefund + 0.001) {
      setError(
        `Refund amount can't exceed ${formatGHS(
          maxRefund
        )} (remaining balance).`
      );
      return;
    }
    if (!reason.trim()) {
      setError("Please add a short reason for the audit log.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({
        amountGHS: Math.round(parsedAmount * 100) / 100,
        reason: reason.trim(),
        notifyCustomer: notify,
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
        aria-labelledby="refund-title"
        className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-clay-400 text-cream-50 shrink-0">
            <Undo2 size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-clay-600">
              Super Admin · destructive
            </p>
            <h3
              id="refund-title"
              className="display text-xl font-semibold leading-tight"
            >
              Refund order #{order.id.slice(-6).toUpperCase()}
            </h3>
            <p className="text-xs text-charcoal-400 mt-0.5">
              For {order.recipient.fullName.split(" ")[0]} · total{" "}
              {formatGHS(order.totalGHS)}
              {alreadyRefunded > 0 && (
                <span>
                  {" "}
                  · already refunded {formatGHS(alreadyRefunded)}
                </span>
              )}
            </p>
          </div>
        </div>

        {!isStripeBacked && (
          <div className="mb-4 rounded-2xl bg-mustard-100 border border-mustard-400/40 px-3 py-2 text-[11px] text-charcoal-700 leading-relaxed">
            <AlertTriangle
              size={11}
              className="inline mr-1 text-mustard-700"
            />
            This order has no Stripe payment intent. Refund will be recorded
            locally but no funds will actually move.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Refund amount
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setFullAmount(true);
                  setAmountStr(maxRefund.toFixed(2));
                }}
                className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                  fullAmount
                    ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                    : "bg-white border-charcoal-100 hover:border-charcoal-400"
                }`}
              >
                Full · {formatGHS(maxRefund)}
              </button>
              <button
                type="button"
                onClick={() => setFullAmount(false)}
                className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                  !fullAmount
                    ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                    : "bg-white border-charcoal-100 hover:border-charcoal-400"
                }`}
              >
                Partial
              </button>
            </div>
            {!fullAmount && (
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-sm font-semibold pointer-events-none">
                    GH₵
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={maxRefund}
                    step="0.01"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="input-base pl-14 tabular-nums"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-charcoal-400 mt-1">
                  Max {formatGHS(maxRefund)}
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Reason · required
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-base min-h-[88px] resize-none"
              placeholder="e.g. Customer reported missing items, vendor cancelled, duplicate charge…"
              maxLength={300}
              rows={3}
            />
            <p className="text-[10px] text-charcoal-400 mt-1">
              Recorded in the audit log and appended to the order's admin note.
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
                Notify the customer
              </span>
              <span className="text-[11px] text-charcoal-400 leading-snug">
                Sends an in-app notification plus a branded email receipt
                with refund amount and ETA. Turn off for silent corrections.
              </span>
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-xs px-4 py-2"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-clay-400 hover:bg-clay-600 text-cream-50 text-sm font-bold py-3 transition disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Processing
                  refund…
                </>
              ) : (
                <>
                  <Undo2 size={14} /> Process {formatGHS(safeAmount)} refund
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-outline disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
