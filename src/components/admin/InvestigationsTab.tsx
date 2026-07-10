import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import { relativeTime } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Eye, XCircle } from "lucide-react";
import AdminEventFeed from "@/components/admin/AdminEventFeed";
import CancelOrderModal from "@/components/features/CancelOrderModal";
import { can } from "@/lib/permissions";
import type { Order } from "@/types";

export default function InvestigationsTab() {
  const { orders, updateOrderStatus, cancelOrder, setAdminNote, shops, user } =
    useApp();
  const navigate = useNavigate();
  const canCancel = can("orders.cancel", user);
  const canRefund = can("orders.refund", user);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const flagged = useMemo(
    () => orders.filter((o) => o.status === "Flagged for Investigation"),
    [orders]
  );

  const recentlyResolved = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            (o.status === "Completed" || o.status === "Cancelled") &&
            o.recipientConfirmed === "no"
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5),
    [orders]
  );

  return (
    <>
      <div className="mb-4">
        <h2 className="display text-2xl font-semibold flex items-center gap-2">
          <AlertTriangle className="text-clay-600" size={20} /> Investigations
        </h2>
        <p className="text-sm text-charcoal-400">
          Orders where the recipient reported a problem. Resolve them quickly
          to keep trust high.
        </p>
      </div>

      <AdminEventFeed
        title="Delivery issue feed"
        subtitle="Every recipient-reported problem, newest first"
        filter={["Flagged for Investigation"]}
        limit={6}
        emptyText="No delivery issues reported. Keep the streak going."
        className="mb-4"
      />

      {flagged.length === 0 ? (
        <div className="card-base p-10 text-center">
          <div className="text-5xl mb-2">✅</div>
          <p className="display text-xl font-semibold">
            No open investigations
          </p>
          <p className="text-sm text-charcoal-400 mt-1">
            Everything's running smoothly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {flagged.map((o) => {
            const shop = shops.find((s) => s.id === o.shopId);
            return (
              <div
                key={o.id}
                className="card-base border-clay-400/40 bg-clay-400/5 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-clay-600">
                      Flagged · #{o.id.slice(-6).toUpperCase()}
                    </div>
                    <p className="display font-semibold text-lg leading-tight mt-0.5 truncate">
                      {o.recipient.emoji} {o.recipient.fullName}
                    </p>
                    <p className="text-xs text-charcoal-400 mt-0.5 truncate">
                      {shop?.name} · From {o.senderName} ·{" "}
                      {relativeTime(o.createdAt)}
                    </p>
                    <p className="text-xs text-charcoal-400 mt-1">
                      {o.recipient.address}, {o.recipient.city} ·{" "}
                      {o.recipient.phone}
                    </p>
                  </div>
                  <p className="display font-bold tabular-nums shrink-0">
                    {formatGHS(o.totalGHS)}
                  </p>
                </div>

                <textarea
                  defaultValue={o.adminNote ?? ""}
                  placeholder="Investigation notes (cause, customer comms, resolution plan)…"
                  onBlur={(e) => setAdminNote(o.id, e.target.value)}
                  className="input-base mt-3 text-xs min-h-[64px]"
                />

                <div className={`grid ${canCancel ? "grid-cols-2" : "grid-cols-1"} gap-2 mt-3`}>
                  <button
                    onClick={() => updateOrderStatus(o.id, "Completed")}
                    className="btn-yellow text-xs py-2.5"
                  >
                    <CheckCircle2 size={14} /> Mark resolved
                  </button>
                  {canCancel && (
                    <button
                      onClick={() => setCancelTarget(o)}
                      className="btn-outline text-xs py-2.5 text-clay-600"
                    >
                      <XCircle size={14} /> Cancel & refund
                    </button>
                  )}
                </div>
                <Link
                  to={`/orders/${o.id}`}
                  className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-charcoal-700 hover:underline"
                >
                  <Eye size={12} /> View full order
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {recentlyResolved.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
            Recently resolved
          </h3>
          <div className="space-y-2">
            {recentlyResolved.map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="card-base p-3 flex items-center gap-3 hover:border-charcoal-400 transition"
              >
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-cream-100 text-lg">
                  {o.recipient.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {o.recipient.fullName}
                  </p>
                  <p className="text-[11px] text-charcoal-400 truncate">
                    #{o.id.slice(-6).toUpperCase()} ·{" "}
                    {o.status === "Completed" ? "Marked resolved" : "Cancelled"}
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums">
                  {formatGHS(o.totalGHS)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          canRefund={canRefund}
          onClose={() => setCancelTarget(null)}
          onConfirm={({ reason, notifyCustomer, alsoRefund }) => {
            const targetId = cancelTarget.id;
            cancelOrder(targetId, reason, { notifyCustomer });
            setCancelTarget(null);
            if (alsoRefund) {
              navigate(`/orders/${targetId}`, {
                state: { openRefundWith: reason },
              });
            }
          }}
        />
      )}
    </>
  );
}
