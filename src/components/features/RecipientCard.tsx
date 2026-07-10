import { ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Recipient } from "@/types";

export default function RecipientCard({
  recipient,
  featured,
  compact,
  orderCount,
}: {
  recipient: Recipient;
  featured?: boolean;
  compact?: boolean;
  orderCount?: number;
}) {
  if (compact) {
    return (
      <Link
        to={`/recipient/${recipient.id}`}
        className="group flex items-center gap-3 px-3 py-2.5 rounded-2xl border bg-white border-charcoal-100 hover:border-charcoal-400 shadow-soft transition-all"
      >
        <div className="grid place-items-center w-11 h-11 rounded-xl text-xl shrink-0 bg-cream-100">
          {recipient.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm leading-tight truncate text-charcoal-900">
              {recipient.fullName}
            </h3>
            {orderCount !== undefined && orderCount > 0 && (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-mustard-700 bg-mustard-100 rounded-full px-1.5 py-0.5">
                {orderCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-charcoal-400 mt-0.5 truncate">
            <span className="font-medium">{recipient.relationship}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{recipient.city}</span>
          </div>
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-charcoal-400 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    );
  }

  return (
    <Link
      to={`/recipient/${recipient.id}`}
      className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all ${
        featured
          ? "bg-charcoal-800 text-cream-50 border-charcoal-700 shadow-card"
          : "bg-white border-charcoal-100 hover:border-charcoal-400 shadow-soft"
      }`}
    >
      <div
        className={`grid place-items-center w-14 h-14 rounded-2xl text-2xl shrink-0 ${
          featured ? "bg-mustard-400 text-charcoal-900" : "bg-cream-100"
        }`}
      >
        {recipient.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[11px] uppercase tracking-wider font-semibold ${
            featured ? "text-mustard-400" : "text-charcoal-400"
          }`}
        >
          {recipient.relationship}
        </div>
        <h3 className="display text-lg font-semibold leading-tight truncate">
          {recipient.fullName}
        </h3>
        <div
          className={`flex items-center gap-1 text-xs mt-0.5 ${
            featured ? "text-cream-100/70" : "text-charcoal-400"
          }`}
        >
          <MapPin size={12} />
          <span className="truncate">{recipient.city}</span>
        </div>
      </div>
      <ChevronRight
        size={18}
        className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${
          featured ? "text-cream-100" : "text-charcoal-400"
        }`}
      />
    </Link>
  );
}
