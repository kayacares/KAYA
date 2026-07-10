import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreLaunchBannerProps {
  variant?: "chip" | "card";
  className?: string;
}

/**
 * Two presentations for the pre-launch message:
 *
 *  • "chip"  — compact pill suited to the top of Home / browsing pages.
 *  • "card"  — fuller panel suited to the top of Cart so users understand
 *              why "Checkout" doesn't take payment yet.
 */
export default function PreLaunchBanner({
  variant = "chip",
  className,
}: PreLaunchBannerProps) {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "card-base p-4 bg-mustard-100 border-mustard-400/60",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="display font-semibold text-base text-charcoal-900 leading-tight">
              Your basket is saved for launch day
            </p>
            <p className="text-xs text-charcoal-700 mt-1 leading-relaxed">
              KAYA is preparing for launch in Accra & Tema. We'll email you
              the moment we open for orders so your loved ones can get their
              first care package right away.
            </p>
            <Link
              to="/checkout"
              className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal-900 mt-2 underline-offset-2 hover:underline"
            >
              See launch details <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      to="/checkout"
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-charcoal-800 text-cream-50 px-3 py-1.5 shadow-soft hover:bg-charcoal-700 transition group",
        className
      )}
    >
      <span className="grid place-items-center w-5 h-5 rounded-full bg-mustard-400 text-charcoal-900 shrink-0">
        <Sparkles size={11} />
      </span>
      <span className="text-[11px] uppercase tracking-wider font-bold text-mustard-400">
        Pre-launch
      </span>
      <span className="text-[11px] font-semibold text-cream-50/90">
        Accra & Tema launching soon
      </span>
      <ArrowRight
        size={12}
        className="text-cream-50/70 group-hover:translate-x-0.5 transition shrink-0"
      />
    </Link>
  );
}
