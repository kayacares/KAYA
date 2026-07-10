import { useState } from "react";
import { Minus, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/lib/currency";
import QuickProductSheet from "@/components/features/QuickProductSheet";
import OptimizedImage from "@/components/features/OptimizedImage";

/**
 * Product tile in the Shop grid. The whole card is a tap target that
 * opens the Quick Product Sheet (slide-up modal) so customers can
 * preview details without leaving the shop. The + button (and the
 * \u2212 N + stepper that appears after first add) short-circuit the
 * card-level tap via stopPropagation so they act directly without
 * opening the sheet \u2014 making it possible to add a single tap
 * straight from the grid for fast grocery shopping.
 */
export default function ProductCard({ product }: { product: Product }) {
  const { cart, addToCart, updateCartQty, user } = useApp();
  const line = cart.find((l) => l.productId === product.id);
  const currency = user?.currency ?? "GHS";
  const availability =
    product.availability ?? (product.active ? "active" : "inactive");
  const isAvailable = availability === "active";
  const isTempUnavailable = availability === "temporarily_unavailable";
  const [sheetOpen, setSheetOpen] = useState(false);

  const openSheet = () => setSheetOpen(true);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`View details for ${product.name}`}
        onClick={openSheet}
        onKeyDown={(e) => {
          // Only react to Enter / Space when focus is on the card
          // itself \u2014 not on an inner button that bubbled the event.
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openSheet();
          }
        }}
        className="card-base overflow-hidden flex flex-col cursor-pointer text-left transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5 hover:border-charcoal-100 focus:outline-none focus:ring-2 focus:ring-mustard-400/50"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-cream-100">
          <OptimizedImage
            src={product.image}
            alt={product.name}
            size="productCard"
            className={`w-full h-full object-cover transition-transform duration-500 ${
              isTempUnavailable ? "grayscale" : "hover:scale-105"
            }`}
          />
          {isTempUnavailable && (
            <div className="absolute inset-0 grid place-items-center bg-charcoal-900/55">
              <span className="rounded-full bg-charcoal-900 text-cream-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                Temporarily Unavailable
              </span>
            </div>
          )}
        </div>
        <div className="p-3.5 flex-1 flex flex-col">
          <div className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
            {product.category}
          </div>
          <h3 className="font-display font-semibold text-[15px] leading-snug mt-1 text-charcoal-900 line-clamp-2">
            {product.name}
          </h3>
          <p className="text-xs text-charcoal-400 mt-1">{product.unit}</p>
          {product.warrantyMonths && product.warrantyMonths > 0 ? (
            <span
              className="mt-1.5 inline-flex items-center gap-1 self-start rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-eyebrow"
              title={`Includes ${product.warrantyMonths}-month manufacturer warranty`}
            >
              <ShieldCheck size={10} /> {product.warrantyMonths}-mo warranty
            </span>
          ) : null}
          <div className="mt-auto pt-3 flex items-center justify-between gap-2">
            <div>
              <div className="display text-lg font-bold text-charcoal-900 leading-none tabular-nums">
                {formatCurrency(product.sellingPrice, currency)}
              </div>
              {currency !== "GHS" && (
                <div className="text-[10px] text-charcoal-400 mt-0.5">
                  \u2248 GH\u20B5{product.sellingPrice.toFixed(0)}
                </div>
              )}
            </div>
            {!isAvailable ? (
              <button
                type="button"
                disabled
                onClick={(e) => e.stopPropagation()}
                aria-label="Temporarily unavailable"
                title="Temporarily unavailable"
                className="grid place-items-center w-9 h-9 rounded-full bg-charcoal-100 text-charcoal-400 cursor-not-allowed"
              >
                <Plus size={16} />
              </button>
            ) : !line ? (
              <button
                type="button"
                onClick={(e) => {
                  // Spec: tapping + adds one item immediately without
                  // opening the sheet, plus a brief "Added to Cart"
                  // confirmation. The card then re-renders with the
                  // \u2212 N + stepper because `line` now exists.
                  e.stopPropagation();
                  addToCart(product.id, 1);
                  toast.success("Added to Cart", {
                    description: product.name,
                  });
                }}
                className="grid place-items-center w-10 h-10 rounded-full bg-charcoal-900 text-cream-50 hover:bg-charcoal-700 active:scale-95 transition shadow-soft hover:shadow-card"
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus size={17} strokeWidth={2.5} />
              </button>
            ) : (
              <div
                role="presentation"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 bg-mustard-400 rounded-full p-0.5 shadow-cta"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateCartQty(product.id, line.quantity - 1);
                  }}
                  className="grid place-items-center w-7 h-7 rounded-full hover:bg-mustard-500 active:scale-95 transition"
                  aria-label={`Decrease ${product.name} quantity`}
                >
                  <Minus size={13} />
                </button>
                <span className="text-xs font-bold min-w-[18px] text-center tabular-nums">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateCartQty(product.id, line.quantity + 1);
                  }}
                  className="grid place-items-center w-7 h-7 rounded-full hover:bg-mustard-500 active:scale-95 transition"
                  aria-label={`Increase ${product.name} quantity`}
                >
                  <Plus size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {sheetOpen && (
        <QuickProductSheet
          product={product}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
