import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import { relativeTime } from "@/lib/utils";
import StatusBadge from "@/components/features/StatusBadge";
import LocationStatusPill from "@/components/features/LocationStatusPill";
import AdminEventFeed from "@/components/admin/AdminEventFeed";
import DailyScheduleView from "@/components/admin/DailyScheduleView";
import CancelOrderModal from "@/components/features/CancelOrderModal";
import SubstitutionModal from "@/components/features/SubstitutionModal";
import { can } from "@/lib/permissions";
import type { Order, OrderStatus } from "@/types";
import {
  Camera,
  ChevronDown,
  Eye,
  Replace,
  Search,
  X,
  XCircle,
} from "lucide-react";

const PIPELINE: OrderStatus[] = [
  "Pending",
  "Paid",
  "Assigned to Vendor",
  "Being Prepared",
  "Out for Delivery",
  "Delivered",
  "Completed",
  "Flagged for Investigation",
  "Needs Attention",
  "Cancelled",
];

export default function OrdersTab() {
  const {
    orders,
    vendors,
    shops,
    user,
    products,
    highValueThresholdGHS,
    updateOrderStatus,
    assignVendor,
    setDeliveryPhoto,
    cancelOrder,
    recordSubstitution,
  } = useApp();
  const navigate = useNavigate();
  const canCancel = can("orders.cancel", user);
  const canRefund = can("orders.refund", user);
  const canSubstitute = can("orders.substitute", user);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [substituteTarget, setSubstituteTarget] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.recipient.fullName.toLowerCase().includes(q) ||
        o.senderName.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
      );
    });
  }, [orders, status, query]);

  return (
    <>
      <div className="mb-3">
        <h2 className="display text-2xl font-semibold">Orders</h2>
        <p className="text-sm text-charcoal-400">
          {filtered.length} of {orders.length} in pipeline
        </p>
      </div>

      <DailyScheduleView />

      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by ID, sender, recipient or status"
          className="input-base pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-full bg-charcoal-100"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AdminEventFeed
        title="Live ops feed"
        subtitle="Out for delivery, delivered and delivery issues across every order"
        filter={[
          "Out for Delivery",
          "Delivered",
          "Flagged for Investigation",
          "Cancelled",
        ]}
        limit={6}
        emptyText="No recent delivery activity. New events will appear here in real time."
        className="mb-4"
      />

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-4">
        <FilterPill
          label={`All · ${orders.length}`}
          active={status === "all"}
          onClick={() => setStatus("all")}
        />
        {PIPELINE.map((s) => {
          const count = orders.filter((o) => o.status === s).length;
          if (count === 0 && status !== s) return null;
          return (
            <FilterPill
              key={s}
              label={`${s} · ${count}`}
              active={status === s}
              onClick={() => setStatus(s)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-8 text-center text-sm text-charcoal-400">
          No orders match.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const shop = shops.find((s) => s.id === o.shopId);
            const availableVendors = vendors.filter(
              (v) => v.active && v.categories.includes(o.shopId)
            );
            return (
              <div key={o.id} className="card-base p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
                      #{o.id.slice(-6).toUpperCase()} · {shop?.emoji}{" "}
                      {shop?.name}
                    </div>
                    <p className="display font-semibold text-lg leading-tight mt-0.5 truncate">
                      {o.recipient.emoji} {o.recipient.fullName}
                    </p>
                    <p className="text-xs text-charcoal-400 mt-0.5 truncate">
                      From {o.senderName} · {relativeTime(o.createdAt)}
                    </p>
                    <p className="text-xs text-charcoal-400 mt-0.5 truncate">
                      {o.recipient.address}, {o.recipient.city}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <LocationStatusPill order={o} />
                    </div>
                    {o.substitutionPreference &&
                      o.substitutionPreference !== "allow" && (
                        <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700 mt-1 flex items-center gap-1">
                          <Replace size={10} />
                          {o.substitutionPreference === "contact_first"
                            ? "Contact before substituting"
                            : "Remove if unavailable"}
                        </p>
                      )}
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={o.status} />
                    <p className="display font-bold mt-1 tabular-nums">
                      {formatGHS(o.totalGHS)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <label className="block">
                    <span className="text-charcoal-400 font-semibold">
                      Vendor
                    </span>
                    <div className="relative">
                      <select
                        value={o.vendorId ?? ""}
                        onChange={(e) => assignVendor(o.id, e.target.value)}
                        className="input-base mt-1 appearance-none text-sm pr-8"
                      >
                        <option value="">Unassigned</option>
                        {availableVendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 pointer-events-none text-charcoal-400"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-charcoal-400 font-semibold">
                      Status
                    </span>
                    <div className="relative">
                      <select
                        value={o.status}
                        onChange={(e) =>
                          updateOrderStatus(o.id, e.target.value as OrderStatus)
                        }
                        className="input-base mt-1 appearance-none text-sm pr-8"
                      >
                        {PIPELINE.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 pointer-events-none text-charcoal-400"
                      />
                    </div>
                  </label>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Camera
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
                    />
                    <input
                      type="url"
                      placeholder="Delivery photo URL (optional)"
                      defaultValue={o.deliveryPhoto || ""}
                      onBlur={(e) => setDeliveryPhoto(o.id, e.target.value)}
                      className="input-base text-xs py-2 pl-8"
                    />
                  </div>
                  <Link
                    to={`/orders/${o.id}`}
                    className="btn-ghost text-xs py-2 px-3 shrink-0"
                    aria-label="View order"
                  >
                    <Eye size={13} />
                  </Link>
                  {o.status !== "Cancelled" &&
                    o.status !== "Completed" &&
                    canSubstitute &&
                    o.items.length > 0 && (
                      <button
                        onClick={() => setSubstituteTarget(o)}
                        className="btn-ghost text-xs py-2 px-3 shrink-0 text-mustard-700"
                        aria-label="Handle substitution"
                        title="Handle substitution"
                      >
                        <Replace size={13} />
                      </button>
                    )}
                  {o.status !== "Cancelled" &&
                    o.status !== "Completed" &&
                    canCancel && (
                      <button
                        onClick={() => setCancelTarget(o)}
                        className="btn-ghost text-xs py-2 px-3 shrink-0 text-clay-600"
                        aria-label="Cancel order"
                      >
                        <XCircle size={13} />
                      </button>
                    )}
                </div>
              </div>
            );
          })}
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

      {substituteTarget && (
        <SubstitutionModal
          order={substituteTarget}
          products={products}
          highValueThreshold={highValueThresholdGHS}
          onClose={() => setSubstituteTarget(null)}
          onSubmit={(data) => {
            const result = recordSubstitution(substituteTarget.id, data);
            if (result.ok) setSubstituteTarget(null);
          }}
        />
      )}
    </>
  );
}

function FilterPill({
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
