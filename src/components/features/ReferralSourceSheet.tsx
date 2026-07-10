import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { REFERRAL_OPTIONS, REFERRAL_SOURCES } from "@/lib/referral";
import { cn } from "@/lib/utils";
import type { ReferralSource } from "@/types";

interface ReferralSourceSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * One-time post-onboarding prompt asking new customers how they heard
 * about KAYA. Slides up on mobile, scales-in on desktop. The answer (or
 * skip) is persisted to user.referralPromptedAt so the sheet never
 * reappears for the same account.
 */
export default function ReferralSourceSheet({
  open,
  onClose,
}: ReferralSourceSheetProps) {
  const { respondToReferralPrompt } = useApp();

  // Lock background scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const choose = (source: ReferralSource | null) => {
    respondToReferralPrompt(source);
    if (source) {
      toast("Thank you", {
        description: "We appreciate you helping KAYA reach more loved ones.",
        duration: 3500,
      });
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kaya-referral-title"
      className="fixed inset-0 z-50 grid items-end sm:items-center justify-items-center bg-charcoal-900/60 backdrop-blur-sm animate-fade-in"
      onClick={() => choose(null)}
    >
      <div
        className="w-full sm:max-w-md bg-cream-50 rounded-t-3xl sm:rounded-3xl shadow-card p-5 sm:p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="chip bg-mustard-400 text-charcoal-900">
            <Sparkles size={12} /> One quick question
          </span>
          <button
            type="button"
            onClick={() => choose(null)}
            className="grid place-items-center w-8 h-8 rounded-full hover:bg-cream-100 transition shrink-0"
            aria-label="Skip this question"
          >
            <X size={16} className="text-charcoal-400" />
          </button>
        </div>

        <h2
          id="kaya-referral-title"
          className="display text-xl sm:text-2xl font-semibold leading-tight"
        >
          How did you hear about KAYA?
        </h2>
        <p className="text-sm text-charcoal-400 mt-1">
          Totally optional — helps us thank the people getting the word out.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {REFERRAL_SOURCES.map((source) => {
            const cfg = REFERRAL_OPTIONS[source];
            const Icon = cfg.Icon;
            return (
              <button
                key={source}
                type="button"
                onClick={() => choose(source)}
                className="card-base p-3 text-left hover:border-charcoal-400 hover:bg-cream-100 transition active:scale-[0.98]"
              >
                <span
                  className={cn(
                    "grid place-items-center w-9 h-9 rounded-2xl mb-2",
                    cfg.tile
                  )}
                  aria-hidden
                >
                  <Icon size={15} />
                </span>
                <p className="text-xs font-semibold leading-tight text-charcoal-900">
                  {cfg.short}
                </p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => choose(null)}
          className="w-full mt-4 text-xs font-semibold text-charcoal-400 hover:text-charcoal-900 transition py-2.5"
        >
          Skip this question
        </button>
      </div>
    </div>
  );
}
