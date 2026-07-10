import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import { formatDate } from "@/lib/utils";
import { Search, X } from "lucide-react";
import type { UserRole } from "@/types";

const ROLE_PILL: Record<UserRole, string> = {
  customer: "bg-cream-200 text-charcoal-700",
  ops: "bg-sage-300 text-charcoal-900",
  admin: "bg-mustard-400 text-charcoal-900",
  super_admin: "bg-charcoal-900 text-cream-50",
};

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Customer",
  ops: "Operations",
  admin: "Admin",
  super_admin: "Super Admin",
};

const COUNTRY_FLAG: Record<string, string> = {
  USA: "🇺🇸",
  Canada: "🇨🇦",
  UK: "🇬🇧",
  Germany: "🇩🇪",
  UAE: "🇦🇪",
  France: "🇫🇷",
  Netherlands: "🇳🇱",
};

export default function CustomersTab() {
  const { customers, orders } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | UserRole>("all");

  const stats = useMemo(() => {
    const m = new Map<
      string,
      { count: number; totalGHS: number; last?: string }
    >();
    orders.forEach((o) => {
      const cur = m.get(o.senderId) ?? { count: 0, totalGHS: 0 };
      cur.count += 1;
      cur.totalGHS += o.totalGHS;
      if (!cur.last || new Date(o.createdAt) > new Date(cur.last))
        cur.last = o.createdAt;
      m.set(o.senderId, cur);
    });
    return m;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((u) => filter === "all" || (u.role ?? "customer") === filter)
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone ?? "").toLowerCase().includes(q)
        );
      });
  }, [customers, filter, query]);

  return (
    <>
      <div className="mb-3">
        <h2 className="display text-2xl font-semibold">Customers & staff</h2>
        <p className="text-sm text-charcoal-400">
          {customers.length} accounts across senders and staff.
        </p>
      </div>

      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or phone"
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

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(["all", "customer", "ops", "admin", "super_admin"] as const).map(
          (r) => {
            const c =
              r === "all"
                ? customers.length
                : customers.filter((u) => (u.role ?? "customer") === r).length;
            return (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                  filter === r
                    ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                    : "bg-white border-charcoal-100 text-charcoal-700 hover:border-charcoal-400"
                }`}
              >
                {r === "all" ? "All" : ROLE_LABEL[r]} · {c}
              </button>
            );
          }
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((u) => {
          const role = u.role ?? "customer";
          const s = stats.get(u.id);
          return (
            <div key={u.id} className="card-base p-4 flex items-start gap-3">
              <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cream-100 display font-bold text-lg shrink-0">
                {(u.firstName?.[0] ?? u.name[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{u.name}</p>
                  <span className={`chip text-[10px] ${ROLE_PILL[role]}`}>
                    {ROLE_LABEL[role]}
                  </span>
                </div>
                <p className="text-xs text-charcoal-400 mt-0.5 truncate">
                  {u.email}
                  {u.phone && ` · ${u.phone}`}
                </p>
                <p className="text-xs text-charcoal-400 mt-0.5">
                  {COUNTRY_FLAG[u.country] ?? "🌍"} {u.country} · {u.currency}
                  {u.joinedAt && ` · Joined ${formatDate(u.joinedAt)}`}
                </p>
                {u.referralSource && (
                  <p className="text-[10px] uppercase tracking-wider text-charcoal-400 mt-1.5 font-semibold">
                    Heard via {u.referralSource}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="display font-bold tabular-nums">
                  {s?.count ?? 0}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">
                  orders
                </p>
                {s?.totalGHS ? (
                  <p className="text-xs font-semibold mt-1">
                    {formatGHS(s.totalGHS)}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card-base p-8 text-center text-sm text-charcoal-400">
            No accounts match.
          </div>
        )}
      </div>
    </>
  );
}
