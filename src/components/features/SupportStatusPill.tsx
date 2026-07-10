import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getSupportStatus,
  loadTawk,
  subscribeSupportStatus,
  type SupportStatus,
} from "@/lib/support";

type SupportStatusPillVariant = "default" | "inverse" | "compact";

interface SupportStatusPillProps {
  variant?: SupportStatusPillVariant;
  className?: string;
}

const LIGHT_PALETTE: Record<
  SupportStatus,
  { label: string; dot: string; pill: string; live?: boolean }
> = {
  disabled: {
    label: "Email only",
    dot: "bg-charcoal-400",
    pill: "bg-charcoal-100 text-charcoal-700",
  },
  loading: {
    label: "Connecting chat…",
    dot: "bg-mustard-400 animate-pulse",
    pill: "bg-mustard-100 text-charcoal-700",
    live: true,
  },
  ready: {
    label: "Live chat online",
    dot: "bg-sage-700",
    pill: "bg-sage-100 text-sage-700",
  },
  fallback: {
    label: "Email & phone",
    dot: "bg-clay-400",
    pill: "bg-clay-100 text-clay-600",
  },
};

const INVERSE_PALETTE: Record<
  SupportStatus,
  { label: string; dot: string; pill: string }
> = {
  disabled: {
    label: "Email only",
    dot: "bg-cream-100/40",
    pill: "bg-cream-50/10 text-cream-100/80",
  },
  loading: {
    label: "Connecting chat…",
    dot: "bg-mustard-400 animate-pulse",
    pill: "bg-mustard-400/20 text-mustard-400",
  },
  ready: {
    label: "Live chat online",
    dot: "bg-sage-300",
    pill: "bg-sage-300/20 text-sage-300",
  },
  fallback: {
    label: "Email & phone",
    dot: "bg-clay-400",
    pill: "bg-clay-400/20 text-clay-400",
  },
};

/**
 * Live status indicator for KAYA Operations support. Subscribes to the
 * Tawk.to widget's lifecycle so the label automatically flips from
 * "Connecting chat…" → "Live chat online" / "Email & phone" as the
 * widget initialises (or fails to). Drop into any support surface.
 */
export default function SupportStatusPill({
  variant = "default",
  className,
}: SupportStatusPillProps) {
  const [status, setStatus] = useState<SupportStatus>(() => getSupportStatus());

  useEffect(() => {
    // Kick off the script as soon as the pill mounts so the user sees
    // an accurate state without needing to click anything first.
    loadTawk();
    const unsubscribe = subscribeSupportStatus(setStatus);
    return unsubscribe;
  }, []);

  const palette =
    variant === "inverse" ? INVERSE_PALETTE[status] : LIGHT_PALETTE[status];

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-block w-2 h-2 rounded-full",
          palette.dot,
          className
        )}
        role="status"
        aria-label={palette.label}
        title={palette.label}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
        palette.pill,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full shrink-0", palette.dot)}
        aria-hidden
      />
      {palette.label}
    </span>
  );
}
