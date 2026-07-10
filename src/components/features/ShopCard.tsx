import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { formatGHS } from "@/lib/currency";
import OptimizedImage from "@/components/features/OptimizedImage";

interface Props {
  recipientId: string;
  shop: {
    id: string;
    name: string;
    tagline: string;
    minOrderGHS: number;
    accent: string;
    emoji: string;
    description: string;
    /** Optional photograph uploaded by an admin. Renders as the card hero. */
    image?: string;
  };
}

/**
 * Shop tile — 2026 refresh.
 *
 * Photography is now the focal point (4:3 aspect + full-bleed image
 * with rich gradient overlay so the shop name reads as bright ivory
 * text over a real photograph rather than a colored panel). The
 * card lifts on hover with an amber-tinted glow so it feels like a
 * physical card being picked up.
 */
export default function ShopCard({ recipientId, shop }: Props) {
  return (
    <Link
      to={`/recipient/${recipientId}/shop/${shop.id}`}
      className="group relative overflow-hidden rounded-3xl bg-white border border-charcoal-100/70 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {shop.image ? (
        <div className="relative aspect-[4/3] overflow-hidden">
          <OptimizedImage
            src={shop.image}
            alt=""
            size="shopCard"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/40 to-charcoal-900/10"
            aria-hidden
          />
          <div className="absolute top-0 inset-x-0 p-4 sm:p-5 flex items-start justify-between">
            <div className="text-4xl drop-shadow-lg">{shop.emoji}</div>
            <div className="grid place-items-center w-10 h-10 rounded-full bg-white/25 backdrop-blur-md ring-1 ring-white/30 group-hover:bg-mustard-400 group-hover:ring-mustard-400 transition-all">
              <ArrowUpRight
                size={17}
                className="text-cream-50 group-hover:text-charcoal-900 transition-colors"
              />
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-cream-50">
            <div className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-300 drop-shadow">
              {shop.tagline}
            </div>
            <h3 className="display text-xl sm:text-2xl font-bold leading-tight mt-1 drop-shadow-md">
              {shop.name}
            </h3>
          </div>
        </div>
      ) : (
        <div className={`${shop.accent} p-5 flex items-start justify-between`}>
          <div className="text-4xl">{shop.emoji}</div>
          <div className="grid place-items-center w-10 h-10 rounded-full bg-white/30 backdrop-blur group-hover:bg-white/60 transition">
            <ArrowUpRight size={17} />
          </div>
        </div>
      )}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        {!shop.image && (
          <>
            <div className="eyebrow-muted">{shop.tagline}</div>
            <h3 className="display text-xl font-semibold mt-1 text-charcoal-900">
              {shop.name}
            </h3>
          </>
        )}
        <p className="text-sm text-charcoal-700 mt-1 line-clamp-2 leading-relaxed flex-1">
          {shop.description}
        </p>
        <div className="mt-3 flex items-center gap-2">
          {shop.minOrderGHS > 0 ? (
            <span className="chip bg-cream-100 text-charcoal-700">
              Min {formatGHS(shop.minOrderGHS)}
            </span>
          ) : (
            <span className="chip-success">No minimum</span>
          )}
        </div>
      </div>
    </Link>
  );
}
