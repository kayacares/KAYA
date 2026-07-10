import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ChevronRight,
  ChevronUp,
  Info,
  Minus,
  Package,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatGHS } from "@/lib/currency";
import CurrencySelector from "@/components/features/CurrencySelector";
import PreLaunchBanner from "@/components/features/PreLaunchBanner";
import AddRecipientSheet from "@/components/features/AddRecipientSheet";

export default function Cart() {
  const {
    cart,
    products,
    recipients,
    shops,
    activeRecipientId,
    setActiveRecipient,
    updateCartQty,
    removeFromCart,
    user,
  } = useApp();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [feeBreakdownOpen, setFeeBreakdownOpen] = useState(false);

  const lines = useMemo(
    () =>
      cart
        .map((l) => {
          const p = products.find((x) => x.id === l.productId);
          return p ? { ...l, product: p } : null;
        })
        .filter(Boolean) as { productId: string; quantity: number; product: any }[],
    [cart, products]
  );

  const unavailableLines = useMemo(
    () =>
      lines.filter((l) => {
        const a =
          l.product.availability ??
          (l.product.active ? "active" : "inactive");
        return a !== "active";
      }),
    [lines]
  );

  const grouped = useMemo(() => {
    const map: Record<string, typeof lines> = {};
    for (const l of lines) {
      const sid = l.product.shopId;
      map[sid] = map[sid] || [];
      map[sid].push(l);
    }
    return map;
  }, [lines]);

  const subtotalGHS = lines.reduce(
    (s, l) => s + l.product.sellingPrice * l.quantity,
    0
  );
  /**
   * Per-shop delivery fee breakdown — powers the bottom-bar chip,
   * the combined fee total in the CTA, and the expandable breakdown
   * panel. Computed in one pass so the customer sees the same
   * numbers wherever they appear.
   */
  const shopFees = useMemo(() => {
    const shopIds = Array.from(new Set(lines.map((l) => l.product.shopId)));
    return shopIds
      .map((sid) => {
        const shop = shops.find((s) => s.id === sid);
        return {
          shopId: sid,
          name: shop?.name ?? "Unknown shop",
          emoji: shop?.emoji ?? "\uD83D\uDED2",
          fee: shop?.deliveryFeeGHS ?? 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lines, shops]);
  const deliveryFeeTotalGHS = shopFees.reduce((s, f) => s + f.fee, 0);
  const totalGHS = subtotalGHS + deliveryFeeTotalGHS;
  const currency = user?.currency ?? "GHS";
  const recipient =
    recipients.find((r) => r.id === activeRecipientId) || recipients[0];

  return (
    <>
      <TopBar title="Your cart" right={<CurrencySelector />} />
      <main className="container-app px-4 pb-with-cta pt-2">
        {lines.length === 0 ? (
          <div className="card-base p-10 text-center mt-10">
            <div className="text-5xl mb-3">🧺</div>
            <h2 className="display text-2xl font-semibold">
              Your cart is empty.
            </h2>
            <p className="text-sm text-charcoal-400 mt-1 max-w-xs mx-auto">
              Browse our shops and bundles to start sending care.
            </p>
            <Link to="/" className="btn-primary mt-5 inline-flex">
              Explore shops
            </Link>
          </div>
        ) : (
          <>
            <PreLaunchBanner variant="card" className="mb-4" />
            {unavailableLines.length > 0 && (
              <div className="card-base p-4 mb-4 bg-mustard-100 border-mustard-400/40">
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0">
                    <AlertTriangle size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {unavailableLines.length}{" "}
                      {unavailableLines.length === 1
                        ? "item is"
                        : "items are"}{" "}
                      currently unavailable
                    </p>
                    <p className="text-xs text-charcoal-700 mt-1 leading-snug">
                      We'll honour your substitution preference at checkout —
                      pick how you'd like us to handle unavailable items on the
                      next step.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Recipient selector */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
                Sending to
              </h3>
              {recipients.length === 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    user
                      ? setAddOpen(true)
                      : navigate("/login?next=/cart")
                  }
                  className="card-base w-full p-4 flex items-center gap-3 hover:border-charcoal-400 transition text-left"
                >
                  <span className="grid place-items-center w-10 h-10 rounded-2xl bg-cream-100 text-mustard-600 shrink-0">
                    <Plus size={18} />
                  </span>
                  <div>
                    <p className="font-semibold text-sm">
                      Add a recipient to checkout
                    </p>
                    <p className="text-xs text-charcoal-400">
                      Save their address once. Send care anytime.
                    </p>
                  </div>
                </button>
              ) : (
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {recipients.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setActiveRecipient(r.id)}
                      className={`shrink-0 flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
                        (recipient?.id ?? recipients[0]?.id) === r.id
                          ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                          : "bg-white border-charcoal-100 hover:border-charcoal-400"
                      }`}
                    >
                      <span className="text-base">{r.emoji}</span>
                      <span className="font-semibold">{r.fullName}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-charcoal-400/40 hover:border-charcoal-400 px-3 py-2 text-sm font-semibold text-charcoal-700 bg-cream-100/60"
                  >
                    <Plus size={14} /> Add new
                  </button>
                </div>
              )}
            </section>

            {Object.entries(grouped).map(([sid, items]) => {
              // Shops are admin-managed via AppContext, not pulled from a
              // hard-coded seed. If the admin deleted the shop after a
              // customer already added its products to their cart, we
              // gracefully fall back to a generic label rather than
              // crashing.
              const shop = shops.find((s) => s.id === sid);
              const shopName = shop?.name ?? "Unknown shop";
              const shopEmoji = shop?.emoji ?? "\uD83D\uDED2";
              const shopMin = shop?.minOrderGHS ?? 0;
              const shopTotal = items.reduce(
                (s, l) => s + l.product.sellingPrice * l.quantity,
                0
              );
              const meetsMin = shopTotal >= shopMin;
              return (
                <section key={sid} className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="display text-lg font-semibold flex items-center gap-2">
                      <span>{shopEmoji}</span> {shopName}
                    </h3>
                    <span className="text-xs text-charcoal-400">
                      {items.length} items
                    </span>
                  </div>
                  <div className="card-base p-2 divide-y divide-charcoal-100">
                    {items.map((l) => (
                      <div
                        key={l.productId}
                        className="flex items-center gap-3 p-3"
                      >
                        <img
                          src={l.product.image}
                          alt={l.product.name}
                          className="w-14 h-14 rounded-xl object-cover bg-cream-100"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {l.product.name}
                          </p>
                          <p className="text-xs text-charcoal-400">
                            {l.product.unit}
                          </p>
                          <p className="display font-bold text-sm mt-0.5">
                            {formatCurrency(
                              l.product.sellingPrice * l.quantity,
                              user?.currency ?? "GHS"
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-cream-100 rounded-full p-0.5">
                          <button
                            onClick={() =>
                              updateCartQty(l.productId, l.quantity - 1)
                            }
                            className="grid place-items-center w-7 h-7 rounded-full hover:bg-cream-200"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="text-xs font-bold w-5 text-center">
                            {l.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateCartQty(l.productId, l.quantity + 1)
                            }
                            className="grid place-items-center w-7 h-7 rounded-full hover:bg-cream-200"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(l.productId)}
                          className="grid place-items-center w-8 h-8 rounded-full text-charcoal-400 hover:text-clay-600 hover:bg-cream-100"
                          aria-label="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!meetsMin && shopMin > 0 && (
                    <p className="text-xs text-clay-600 mt-2">
                      Add {formatGHS(shopMin - shopTotal)} more to meet
                      the {shopName} minimum.
                    </p>
                  )}
                </section>
              );
            })}
          </>
        )}
      </main>

      {lines.length > 0 && (
        <div className="fixed above-bottom-nav inset-x-0 z-30 px-4">
          <div className="container-app">
            <div className="card-base bg-charcoal-800 text-cream-50 border-charcoal-700 shadow-hi overflow-hidden p-0">
              {/* Expandable breakdown — shows each shop's delivery
                  fee so the customer can see exactly how the combined
                  total breaks down without leaving the cart. */}
              {feeBreakdownOpen && shopFees.length > 0 && (
                <div className="border-b border-charcoal-700/80 bg-charcoal-900/40 px-4 pt-3 pb-3.5 animate-fade-in-up">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-400">
                      Delivery fees by shop
                    </p>
                    <button
                      type="button"
                      onClick={() => setFeeBreakdownOpen(false)}
                      className="grid place-items-center w-7 h-7 rounded-full text-cream-100/70 hover:text-cream-50 hover:bg-cream-50/10 transition"
                      aria-label="Close fee breakdown"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {shopFees.map((sf) => (
                      <li
                        key={sf.shopId}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{sf.emoji}</span>
                          <span className="font-semibold truncate">
                            {sf.name}
                          </span>
                        </span>
                        <span className="tabular-nums font-bold shrink-0">
                          {sf.fee > 0
                            ? formatCurrency(sf.fee, currency)
                            : "Free"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-cream-100/60 mt-3 leading-snug">
                    Each shop has its own delivery fee. We combine them
                    clearly here — nothing extra at checkout.
                  </p>
                </div>
              )}

              {/* Combined delivery fee chip — always visible. Tap to
                  toggle the per-shop breakdown above. */}
              <button
                type="button"
                onClick={() => setFeeBreakdownOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 border-b border-charcoal-700/80 hover:bg-charcoal-900/30 transition text-left"
                aria-expanded={feeBreakdownOpen}
                aria-controls="cart-fee-breakdown"
              >
                <span className="flex items-center gap-1.5 text-xs text-cream-100/85">
                  <Package size={13} className="text-mustard-400" />
                  <span className="font-semibold">Combined delivery</span>
                  {shopFees.length > 1 && (
                    <span className="text-cream-100/55">
                      · {shopFees.length} shops
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="tabular-nums text-sm font-bold">
                    {deliveryFeeTotalGHS > 0
                      ? `+ ${formatCurrency(deliveryFeeTotalGHS, currency)}`
                      : "Free"}
                  </span>
                  <ChevronUp
                    size={14}
                    className={`text-cream-100/70 transition-transform ${
                      feeBreakdownOpen ? "" : "rotate-180"
                    }`}
                  />
                </span>
              </button>

              {/* Primary CTA — shows the combined total (subtotal +
                  delivery) so the customer always sees the true
                  amount they're committing to. Guests are bounced to
                  /login?next=/checkout so their cart survives the
                  round-trip through sign-in. */}
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    navigate("/login?next=/checkout");
                    return;
                  }
                  if (recipients.length === 0) {
                    setAddOpen(true);
                    return;
                  }
                  navigate("/checkout");
                }}
                className="w-full p-4 flex items-center justify-between gap-3 hover:bg-charcoal-700 transition text-left"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-mustard-400 font-semibold flex items-center gap-1.5">
                    {recipients.length === 0
                      ? "One more step"
                      : "Total to reserve"}
                    <Info
                      size={11}
                      className="text-mustard-400/70"
                      aria-label="Includes subtotal and combined delivery"
                    />
                  </p>
                  <p className="display text-2xl font-bold tabular-nums">
                    {formatCurrency(totalGHS, currency)}
                  </p>
                  <p className="text-[10px] text-cream-100/60 mt-0.5">
                    {formatCurrency(subtotalGHS, currency)} items
                    {deliveryFeeTotalGHS > 0
                      ? ` + ${formatCurrency(
                          deliveryFeeTotalGHS,
                          currency
                        )} delivery`
                      : " + free delivery"}
                  </p>
                </div>
                <span className="flex items-center gap-2 font-semibold shrink-0">
                  {recipients.length === 0
                    ? "Add a recipient"
                    : "Reserve my spot"}{" "}
                  <ChevronRight size={18} />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      <AddRecipientSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
