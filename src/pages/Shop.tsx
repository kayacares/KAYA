import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import ProductCard from "@/components/features/ProductCard";
import { formatCurrency, formatGHS } from "@/lib/currency";
import { ShoppingBag } from "lucide-react";
import type { ShopId } from "@/types";

/**
 * Shop page — supports two URL shapes:
 *   /shop/:shopId                       browse without a saved recipient
 *   /recipient/:id/shop/:shopId         browse personalised to that recipient
 *
 * No-recipient browsing is the default for new users so they're not gated
 * behind the AddRecipient sheet on the home page. The recipient is collected
 * at the cart / checkout step instead.
 */
export default function Shop() {
  const { id: recipientId, shopId } = useParams<{
    id?: string;
    shopId: ShopId;
  }>();
  const { recipients, products, cart, user, shops, setActiveRecipient } =
    useApp();
  const navigate = useNavigate();

  const recipient = recipientId
    ? recipients.find((r) => r.id === recipientId) ?? null
    : null;
  // Shops are admin-managed via AppContext, not pulled from a hard-coded
  // seed — this guarantees the customer-facing Shop page always reflects
  // exactly what the admin has created or deleted.
  const shop = shops.find((s) => s.id === shopId);

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("All");

  const shopProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.shopId === shopId &&
          (p.availability ?? (p.active ? "active" : "inactive")) !==
            "inactive"
      ),
    [products, shopId]
  );
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(shopProducts.map((p) => p.category)))],
    [shopProducts]
  );
  const filtered = useMemo(
    () =>
      shopProducts.filter(
        (p) =>
          (cat === "All" || p.category === cat) &&
          p.name.toLowerCase().includes(search.toLowerCase())
      ),
    [shopProducts, cat, search]
  );

  const cartLines = cart.filter((l) =>
    shopProducts.some((p) => p.id === l.productId)
  );
  const subtotalGHS = cartLines.reduce((sum, l) => {
    const p = shopProducts.find((x) => x.id === l.productId);
    return sum + (p ? p.sellingPrice * l.quantity : 0);
  }, 0);
  const meetsMin = !shop || subtotalGHS >= shop.minOrderGHS;

  if (!shop) {
    return (
      <>
        <TopBar back title="Not found" />
      </>
    );
  }

  const subtitle = recipient
    ? `For ${recipient.fullName.split(" ")[0]}`
    : "Browse and add to cart";

  return (
    <>
      <TopBar back title={shop.name} subtitle={subtitle} />
      <main className="container-app px-4 pb-with-cta">
        <section className="relative overflow-hidden rounded-3xl mb-5">
          {shop.image ? (
            <>
              <img
                src={shop.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-br from-charcoal-900/80 via-charcoal-900/55 to-charcoal-900/80"
                aria-hidden
              />
            </>
          ) : (
            <div className={`absolute inset-0 ${shop.accent}`} aria-hidden />
          )}
          <div
            className={`relative p-5 ${
              shop.image ? "text-cream-50" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-4xl drop-shadow">{shop.emoji}</div>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">
                  {shop.tagline}
                </div>
                <h2 className="display text-2xl font-semibold leading-tight">
                  {shop.name}
                </h2>
                <p className="text-sm mt-1 opacity-90">{shop.description}</p>
                {shop.minOrderGHS > 0 && (
                  <p className="text-xs font-medium mt-2 opacity-90">
                    Minimum order: {formatGHS(shop.minOrderGHS)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mb-4">
          <input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base"
          />
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                cat === c
                  ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                  : "bg-white border-charcoal-100 hover:border-charcoal-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="card-base p-8 text-center mt-6">
            <p className="text-charcoal-400">No products match your search.</p>
          </div>
        )}
      </main>

      {cartLines.length > 0 && (
        <div className="fixed above-bottom-nav inset-x-0 z-30 px-4 animate-fade-in-up">
          <div className="container-app">
            <div className="card-base bg-charcoal-800 text-cream-50 border-charcoal-700 p-4 flex items-center justify-between gap-3 shadow-hi">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-mustard-400 font-semibold">
                  {cartLines.reduce((a, b) => a + b.quantity, 0)} items
                </p>
                <p className="display text-xl font-bold">
                  {formatCurrency(subtotalGHS, user?.currency ?? "GHS")}
                </p>
                {!meetsMin && (
                  <p className="text-xs text-mustard-400 mt-0.5">
                    Add {formatGHS(shop.minOrderGHS - subtotalGHS)} more to checkout
                  </p>
                )}
                {!recipient && meetsMin && (
                  <p className="text-xs text-mustard-400 mt-0.5">
                    Pick a recipient at checkout
                  </p>
                )}
              </div>
              <button
                disabled={!meetsMin}
                onClick={() => {
                  if (recipient) setActiveRecipient(recipient.id);
                  navigate("/cart");
                }}
                className="btn-yellow disabled:bg-charcoal-700 disabled:text-cream-50/50"
              >
                <ShoppingBag size={16} /> Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
