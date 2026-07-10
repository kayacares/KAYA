import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Bundle } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/lib/currency";
import OptimizedImage from "@/components/features/OptimizedImage";

export default function BundleCard({ bundle }: { bundle: Bundle }) {
  const { products, user } = useApp();
  const currency = user?.currency ?? "GHS";
  const [imgError, setImgError] = useState(false);

  let totalGHS = 0;
  for (const item of bundle.items) {
    const p = products.find((x) => x.id === item.productId);
    if (p) totalGHS += p.sellingPrice * item.quantity;
  }

  return (
    <Link
      to={`/bundle/${bundle.id}`}
      className="group relative overflow-hidden rounded-2xl bg-white border border-charcoal-100 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex flex-col"
    >
      {/* Product image */}
      <div className="relative aspect-[4/3] bg-cream-100 overflow-hidden">
        {bundle.image && !imgError ? (
          <OptimizedImage
            src={bundle.image}
            alt={bundle.name}
            size="carePackageCard"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className={`absolute inset-0 grid place-items-center ${bundle.accent}`}
          >
            <span className="text-6xl">{bundle.emoji}</span>
          </div>
        )}
        {/* Emoji + recipient tag */}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur px-2 py-1 text-[10px] font-bold text-charcoal-900 shadow-soft">
          <span className="text-sm leading-none">{bundle.emoji}</span>
          {bundle.badge && (
            <span className="truncate max-w-[88px] uppercase tracking-wider">
              {bundle.badge}
            </span>
          )}
        </span>
      </div>

      {/* Product body */}
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm leading-snug text-charcoal-900 line-clamp-1">
          {bundle.name}
        </h3>
        <p className="text-[11px] text-charcoal-400 mt-1 line-clamp-2 leading-snug flex-1">
          {bundle.tagline}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="display font-bold text-base text-charcoal-900 tabular-nums">
            {formatCurrency(totalGHS, currency)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-charcoal-900 bg-mustard-400 group-hover:bg-mustard-500 px-2.5 py-1.5 rounded-full transition shrink-0">
            View
            <ArrowRight size={11} />
          </span>
        </div>
      </div>
    </Link>
  );
}
