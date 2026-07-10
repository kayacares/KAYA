import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import { Search, X } from "lucide-react";

export default function RecipientsTab() {
  const { recipients, orders, removeRecipient } = useApp();
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; totalGHS: number }>();
    orders.forEach((o) => {
      const cur = m.get(o.recipient.id) ?? { count: 0, totalGHS: 0 };
      cur.count += 1;
      cur.totalGHS += o.totalGHS;
      m.set(o.recipient.id, cur);
    });
    return m;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.relationship.toLowerCase().includes(q)
    );
  }, [recipients, query]);

  return (
    <>
      <div className="mb-3">
        <h2 className="display text-2xl font-semibold">Recipients</h2>
        <p className="text-sm text-charcoal-400">
          Loved ones receiving care in Accra & Tema. Recipients don't need
          accounts.
        </p>
      </div>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, city or relationship"
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

      <div className="space-y-2">
        {filtered.map((r) => {
          const s = stats.get(r.id);
          return (
            <div key={r.id} className="card-base p-4 flex items-start gap-3">
              <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cream-100 text-xl shrink-0">
                {r.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{r.fullName}</p>
                <p className="text-xs text-charcoal-400 mt-0.5">
                  {r.relationship} · {r.city} · {r.phone}
                </p>
                <p className="text-xs text-charcoal-400 mt-0.5 truncate">
                  {r.address}
                </p>
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
                <button
                  onClick={() => {
                    if (confirm(`Remove ${r.fullName}?`)) removeRecipient(r.id);
                  }}
                  className="text-[11px] text-clay-600 font-semibold mt-1.5"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
