import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import { BUNDLES } from "@/lib/mock-data";
import { formatCurrency, formatGHS } from "@/lib/currency";
import { AlertTriangle, Check, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import AddRecipientSheet from "@/components/features/AddRecipientSheet";
import CurrencySelector from "@/components/features/CurrencySelector";
import type { Product } from "@/types";

export default function Bundle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    products,
    recipients,
    user,
    shops,
    addToCart,
    setActiveRecipient,
    activeRecipientId,
    setCartBundleId,
  } = useApp();
  const bundle = BUNDLES.find((b) => b.id === id);
  const [chosen, setChosen] = useState<string | null>(
    activeRecipientId ?? recipients[0]?.id ?? null
  );
  const [addOpen, setAddOpen] = useState(false);

  const items = useMemo(() => {
    if (!bundle) return [];
    return bundle.items
      .map((it) => {
        const p = products.find((x) => x.id === it.productId);
        return p ? { product: p, quantity: it.quantity } : null;
      })
      .filter(
        (x): x is { product: Product; quantity: number } => x !== null
      );
  }, [bundle, products]);

  const availableItems = useMemo(
    () =>
      items.filter((it) => {
        const a =
          it.product.availability ??
          (it.product.active ? "active" : "inactive");
        return a === "active";
      }),
    [items]
  );
  const unavailableItems = useMemo(
    () =>
      items.filter((it) => {
        const a =
          it.product.availability ??
          (it.product.active ? "active" : "inactive");
        return a !== "active";
      }),
    [items]
  );

  if (!bundle) {
    return (
      <>
        <TopBar back title="Bundle not found" />
        <main className="container-app px-4">
          <p className="text-charcoal-400 mt-6">That bundle doesn't exist.</p>
        </main>
      </>
    );
  }

  const totalGHS = availableItems.reduce(
    (s, it) => s + it.product.sellingPrice * it.quantity,
    0
  );
  const totalItems = availableItems.reduce((s, it) => s + it.quantity, 0);
  const currency = user?.currency ?? "GHS";
  const shop = shops.find((s) => s.id === bundle.shopId)!;
  const underMin = shop.minOrderGHS > 0 && totalGHS < shop.minOrderGHS;

  const send = () => {
    if (availableItems.length === 0) {
      toast.error("All items in this bundle are currently unavailable.");
      return;
    }
    // Guest path — allow adding to cart without a recipient. The
    // recipient will be selected after sign-in on the checkout page.
    if (!user) {
      setCartBundleId(bundle.id);
      for (const it of availableItems)
        addToCart(it.product.id, it.quantity);
      toast.success(`${bundle.name} added`, {
        description: `${availableItems.length} item${
          availableItems.length === 1 ? "" : "s"
        } on the way`,
      });
      navigate("/cart");
      return;
    }
    if (recipients.length === 0) {
      setAddOpen(true);
      return;
    }
    if (!chosen) {
      setAddOpen(true);
      return;
    }
    setActiveRecipient(chosen);
    setCartBundleId(bundle.id);
    for (const it of availableItems) addToCart(it.product.id, it.quantity);
    navigate("/cart");
  };

  return (
    <>
      <TopBar
        back
        title={bundle.name}
        subtitle="Featured bundle"
        right={<CurrencySelector />}
      />
      <main className="container-app px-4 pb-with-cta">
        {/* Hero */}
        <section
          className={`relative overflow-hidden rounded-3xl p-6 ${bundle.accent} mb-5 shadow-card`}
        >
          {bundle.badge && (
            <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/30 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold">
              {bundle.badge}
            </span>
          )}
          <div className="text-6xl">{bundle.emoji}</div>
          <h1 className="display text-3xl font-semibold mt-3 leading-tight">
            {bundle.name}
          </h1>
          <p className="text-sm mt-1.5 opacity-90 max-w-md">
            {bundle.description}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/30 backdrop-blur px-3 py-1 text-xs font-semibold">
              {shop.emoji} {shop.name}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/30 backdrop-blur px-3 py-1 text-xs font-semibold">
              {totalItems} items
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/30 backdrop-blur px-3 py-1 text-xs font-semibold">
              {formatCurrency(totalGHS, currency)}
            </span>
          </div>
        </section>

        {/* Recipient picker — always visible so the shopping
            experience keeps its familiar structure. Guests hit the
            "Add a recipient first" prompt which routes them to
            sign in (and returns them here after auth). */}
        <section className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
            Send this to
          </h3>
          {recipients.length === 0 ? (
            <button
              onClick={() =>
                user
                  ? setAddOpen(true)
                  : navigate(
                      `/login?next=${encodeURIComponent(
                        `/bundle/${bundle.id}`
                      )}`
                    )
              }
              className="card-base w-full p-4 flex items-center gap-3 hover:border-charcoal-400 transition text-left"
            >
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-cream-100 text-mustard-600 shrink-0">
                <Plus size={18} />
              </span>
              <div>
                <p className="font-semibold text-sm">Add a recipient first</p>
                <p className="text-xs text-charcoal-400">
                  Save their address once. Then send care anytime.
                </p>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {recipients.map((r) => {
                const active = chosen === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setChosen(r.id)}
                    className={`relative flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                        : "bg-white text-charcoal-900 border-charcoal-100 hover:border-charcoal-400"
                    }`}
                  >
                    <span className="text-xl shrink-0">{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">
                        {r.fullName}
                      </p>
                      <p
                        className={`text-[10px] truncate ${
                          active ? "text-cream-100/70" : "text-charcoal-400"
                        }`}
                      >
                        {r.relationship}
                      </p>
                    </div>
                    {active && (
                      <Check
                        size={14}
                        className="shrink-0 text-mustard-400"
                      />
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2.5 rounded-2xl border border-dashed border-charcoal-400/40 hover:border-charcoal-400 px-3 py-2.5 text-left bg-cream-100/60"
              >
                <span className="grid place-items-center w-8 h-8 rounded-xl bg-white text-mustard-600 shrink-0">
                  <Plus size={16} />
                </span>
                <p className="text-xs font-semibold">Add new</p>
              </button>
            </div>
          )}
        </section>

        {/* Items */}
        <section className="mb-4">
          {unavailableItems.length > 0 && (
            <div className="rounded-2xl bg-mustard-100 border border-mustard-400/40 text-charcoal-700 text-xs px-4 py-2.5 mb-2 flex items-start gap-2">
              <AlertTriangle
                size={12}
                className="shrink-0 mt-0.5 text-mustard-700"
              />
              <span>
                {unavailableItems.length}{" "}
                {unavailableItems.length === 1 ? "item is" : "items are"}{" "}
                currently unavailable and will be skipped. We'll add the{" "}
                {availableItems.length} available{" "}
                {availableItems.length === 1 ? "item" : "items"} to your cart.
              </span>
            </div>
          )}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
            What's inside
          </h3>
          <div className="card-base divide-y divide-charcoal-100">
            {items.map((it) => {
              const av =
                it.product.availability ??
                (it.product.active ? "active" : "inactive");
              const unavailable = av !== "active";
              return (
                <div
                  key={it.product.id}
                  className={`flex items-center gap-3 p-3 ${
                    unavailable ? "opacity-60" : ""
                  }`}
                >
                  <img
                    src={it.product.image}
                    alt={it.product.name}
                    loading="lazy"
                    className={`w-14 h-14 rounded-xl object-cover bg-cream-100 ${
                      unavailable ? "grayscale" : ""
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {it.product.name}
                    </p>
                    {unavailable ? (
                      <p className="text-[10px] uppercase tracking-wider text-mustard-700 font-bold">
                        Temporarily unavailable · skipped
                      </p>
                    ) : (
                      <p className="text-xs text-charcoal-400">
                        {it.product.unit}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-cream-100 text-charcoal-700 text-xs font-bold tabular-nums">
                    × {it.quantity}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {underMin && (
          <div className="rounded-2xl bg-clay-400/10 border border-clay-400/30 text-clay-600 text-xs px-4 py-2.5 mb-2">
            This bundle is under the {shop.name} minimum of{" "}
            {formatGHS(shop.minOrderGHS)}. You'll be able to add more items
            from your cart.
          </div>
        )}
      </main>

      <div className="fixed above-bottom-nav inset-x-0 z-30 px-4">
        <div className="container-app">
          <button
            onClick={send}
            className="card-base w-full bg-charcoal-800 text-cream-50 border-charcoal-700 p-4 flex items-center justify-between shadow-hi hover:bg-charcoal-700 transition"
          >
            <div className="text-left">
              <p className="text-[11px] uppercase tracking-wider text-mustard-400 font-semibold">
                Bundle total
              </p>
              <p className="display text-2xl font-bold">
                {formatCurrency(totalGHS, currency)}
              </p>
            </div>
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingBag size={18} /> Add to cart
            </span>
          </button>
        </div>
      </div>
      <AddRecipientSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
