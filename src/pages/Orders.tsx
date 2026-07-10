import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/lib/currency";
import { relativeTime } from "@/lib/utils";
import { Search, X } from "lucide-react";
import StatusBadge from "@/components/features/StatusBadge";
import type { OrderStatus } from "@/types";

const STATUS_FILTERS: OrderStatus[] = [
  "Paid",
  "Assigned to Vendor",
  "Being Prepared",
  "Out for Delivery",
  "Delivered",
  "Completed",
  "Flagged for Investigation",
  "Cancelled",
];

export default function Orders() {
  const { orders: allOrders, user } = useApp();
  const orders = useMemo(
    () => (user ? allOrders.filter((o) => o.senderId === user.id) : []),
    [allOrders, user]
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      const idMatch = o.id.toLowerCase().includes(q);
      const nameMatch = o.recipient.fullName.toLowerCase().includes(q);
      const statusMatch = o.status.toLowerCase().includes(q);
      return idMatch || nameMatch || statusMatch;
    });
  }, [orders, query, statusFilter]);

  const hasActiveFilters = query.trim().length > 0 || statusFilter !== "all";

  const clearAll = () => {
    setQuery("");
    setStatusFilter("all");
  };

  return (
    <>
      <TopBar title="Your care history" />
      <main className="container-app px-4 pb-10">
        {orders.length === 0 ? (
          <div className="card-base p-10 text-center mt-10">
            <div className="text-5xl mb-3">📦</div>
            <h2 className="display text-2xl font-semibold">No orders yet.</h2>
            <p className="text-sm text-charcoal-400 mt-1 max-w-xs mx-auto">
              When you send care through KAYA, your orders will appear here.
            </p>
            <Link to="/" className="btn-primary mt-5 inline-flex">
              Explore shops
            </Link>
          </div>
        ) : (
          <>
            <div className="sticky top-[64px] z-10 -mx-4 px-4 pt-2 pb-3 bg-cream-50/95 backdrop-blur-sm">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by recipient, order ID or status"
                  className="input-base pl-9 pr-9"
                  aria-label="Search orders"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-full bg-charcoal-100 hover:bg-charcoal-200 text-charcoal-700"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto hide-scrollbar">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                    statusFilter === "all"
                      ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                      : "bg-white text-charcoal-700 border-charcoal-100 hover:border-charcoal-400"
                  }`}
                >
                  All · {orders.length}
                </button>
                {STATUS_FILTERS.map((s) => {
                  const count = orders.filter((o) => o.status === s).length;
                  const active = statusFilter === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(active ? "all" : s)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                        active
                          ? "bg-mustard-400 text-charcoal-900 border-mustard-400"
                          : "bg-white text-charcoal-700 border-charcoal-100 hover:border-charcoal-400"
                      }`}
                    >
                      {s} · {count}
                    </button>
                  );
                })}
              </div>

              {hasActiveFilters && (
                <div className="mt-3 flex items-center flex-wrap gap-2">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-400">
                    Filtering
                  </span>
                  {query.trim() && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 text-sage-700 px-3 py-1 text-xs font-medium border border-sage-300"
                    >
                      <span className="opacity-70">Search:</span>
                      <span className="font-semibold truncate max-w-[140px]">
                        {query.trim()}
                      </span>
                      <X size={12} />
                    </button>
                  )}
                  {statusFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-mustard-100 text-mustard-700 px-3 py-1 text-xs font-medium border border-mustard-400"
                    >
                      <span className="opacity-70">Status:</span>
                      <span className="font-semibold">{statusFilter}</span>
                      <X size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="ml-auto text-xs font-semibold text-charcoal-700 hover:text-charcoal-900 underline-offset-2 hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-charcoal-400 mb-3 mt-1">
              {filtered.length} of {orders.length}{" "}
              {orders.length === 1 ? "order" : "orders"}
            </p>

            {filtered.length === 0 ? (
              <div className="card-base p-10 text-center mt-2">
                <div className="text-4xl mb-2">🔍</div>
                <h2 className="display text-xl font-semibold">No matches</h2>
                <p className="text-sm text-charcoal-400 mt-1">
                  Try a different search or clear the filters.
                </p>
                <button
                  onClick={clearAll}
                  className="btn-ghost mt-4 inline-flex"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((o) => (
                  <Link
                    key={o.id}
                    to={`/orders/${o.id}`}
                    className="card-base p-4 flex gap-3 items-start hover:border-charcoal-400 transition"
                  >
                    <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cream-100 text-2xl shrink-0">
                      {o.recipient.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate">
                          For {o.recipient.fullName}
                        </p>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="text-xs text-charcoal-400 mt-0.5">
                        {o.items.length} items · {relativeTime(o.createdAt)}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] uppercase tracking-wider text-charcoal-400 font-semibold">
                          {o.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="display font-bold">
                          {formatCurrency(o.totalGHS, user?.currency ?? "GHS")}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
