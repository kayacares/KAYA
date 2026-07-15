import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import type { CarePackage } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/lib/currency";
import OptimizedImage from "@/components/features/OptimizedImage";

/**
 * Customer-facing card for a Care Package. Mirrors the BundleCard
 * shape so the home grid swap-in is seamless, but reads from the new
 * `priceGHS` and `shortDescription` fields and adds a featured star.
 */
export default function CarePackageCard({ pkg }: { pkg: CarePackage }) {
  const { user } = useApp();
  const currency = user?.currency ?? "GHS";
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      to={`/care-package/${pkg.id}`}
      className="group relative overflow-hidden rounded-3xl bg-white border border-charcoal-100/70 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Image is the hero — bumped to 4:5 so photography carries the
          card visually instead of colored text. Any accent color is
          used only as a fallback when no cover image is set. */}
      <div className="relative aspect-[4/5] bg-cream-100 overflow-hidden">
        {pkg.coverImage && !imgError ? (
          <OptimizedImage
            src={pkg.coverImage}
            alt={pkg.name}
            size="carePackageCard"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className={`absolute inset-0 grid place-items-center ${pkg.accent}`}
          >
            <span className="text-6xl">{pkg.emoji}</span>
          </div>
        )}
        {/* Bottom-anchored gradient so the badge & photo work together */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-charcoal-900/50 to-transparent"
          aria-hidden
        />
        {pkg.featured && (
          <span
            className="absolute top-2.5 right-2.5 grid place-items-center w-8 h-8 rounded-full bg-mustard-400 text-charcoal-900 shadow-cta"
            title="Featured care package"
          >
            <Star size={13} fill="currentColor" />
          </span>
        )}
        {pkg.badge && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur px-2.5 py-1 text-[10px] font-bold text-charcoal-900 shadow-soft uppercase tracking-eyebrow">
            {pkg.badge}
          </span>
        )}
      </div>
      <div className="p-3.5 flex-1 flex flex-col">
        <h3 className="font-display font-semibold text-[15px] leading-snug text-charcoal-900 line-clamp-1">
          {pkg.name}
        </h3>
        <p className="text-[11px] text-charcoal-400 mt-1 line-clamp-2 leading-snug flex-1">
          {pkg.shortDescription}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="display font-bold text-lg text-charcoal-900 tabular-nums leading-none">
            {formatCurrency(pkg.priceGHS, currency)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-900 bg-mustard-400 group-hover:bg-mustard-500 px-3 py-1.5 rounded-full transition shrink-0 shadow-cta">
            View
            <ArrowRight size={11} />
          </span>
        </div>
      </div>
    </Link>
  );
}
