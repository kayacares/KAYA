import { useMemo, useState } from "react";
import { Plus, Search, Users, X } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import RecipientCard from "@/components/features/RecipientCard";
import AddRecipientSheet from "@/components/features/AddRecipientSheet";

export default function Recipients() {
  const { recipients, orders } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  const ranked = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      counts[o.recipient.id] = (counts[o.recipient.id] || 0) + 1;
    }
    return [...recipients]
      .map((r) => ({ recipient: r, count: counts[r.id] || 0 }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return (
          new Date(b.recipient.createdAt).getTime() -
          new Date(a.recipient.createdAt).getTime()
        );
      });
  }, [recipients, orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(({ recipient: r }) => {
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.relationship.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
      );
    });
  }, [ranked, query]);

  const top = ranked.slice(0, 3).map(({ recipient }) => recipient.id);

  return (
    <>
      <TopBar
        back
        title="Your people"
        subtitle={`${recipients.length} ${
          recipients.length === 1 ? "recipient" : "recipients"
        }`}
        right={
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 text-xs font-semibold text-charcoal-900 bg-mustard-400 hover:bg-mustard-500 rounded-full px-3 py-1.5 transition"
            aria-label="Add recipient"
          >
            <Plus size={14} /> Add
          </button>
        }
      />
      <main className="container-app px-4 pb-10">
        {recipients.length === 0 ? (
          <div className="card-base p-10 text-center mt-6">
            <div className="grid place-items-center w-14 h-14 rounded-2xl bg-cream-100 mx-auto mb-3">
              <Users className="text-mustard-600" />
            </div>
            <p className="display text-xl font-semibold">
              You haven't added anyone yet.
            </p>
            <p className="text-sm text-charcoal-400 mt-1">
              Add your first recipient ❤️
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="btn-primary mt-5 inline-flex"
            >
              <Plus size={16} /> Add a recipient
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-4 mt-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, relationship or city"
                className="input-base pl-9 pr-9"
                aria-label="Search recipients"
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

            {filtered.length === 0 ? (
              <div className="card-base p-10 text-center">
                <div className="text-4xl mb-2">🔍</div>
                <p className="display text-lg font-semibold">No matches</p>
                <p className="text-sm text-charcoal-400 mt-1">
                  Try a different name or city.
                </p>
                <button
                  onClick={() => setQuery("")}
                  className="btn-ghost mt-4 inline-flex"
                >
                  Reset search
                </button>
              </div>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-400 mb-2">
                  Sorted by most care sent
                </p>
                <div className="space-y-2">
                  {filtered.map(({ recipient, count }) => (
                    <div key={recipient.id} className="relative">
                      <RecipientCard
                        recipient={recipient}
                        compact
                        orderCount={count}
                      />
                      {top.includes(recipient.id) && count > 0 && (
                        <span className="absolute -top-1.5 -left-1.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-mustard-400 text-charcoal-900 text-[9px] font-bold uppercase tracking-wider shadow-soft">
                          ★
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
      <AddRecipientSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
