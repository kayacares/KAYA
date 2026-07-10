import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Heart, Plus, Share, X } from "lucide-react";
import {
  dismissInstall,
  hasInstallPrompt,
  isInstallDismissed,
  isInstalled,
  isIOS,
  onPwaChange,
  promptInstall,
} from "@/lib/pwa";
import { cn } from "@/lib/utils";

export default function InstallPrompt() {
  const loc = useLocation();
  const [, force] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const refresh = () => force((t) => t + 1);
    const unsub = onPwaChange(refresh);
    // Non-intrusive: wait a beat before surfacing
    const t = window.setTimeout(() => setRevealed(true), 3500);
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, []);

  // Staff portal can also be installed to home screen — different copy.
  const isAdminContext = loc.pathname.startsWith("/admin");
  if (!revealed) return null;
  if (isInstalled()) return null;
  if (isInstallDismissed()) return null;

  const androidLike = hasInstallPrompt();
  const ios = isIOS() && !androidLike;
  if (!androidLike && !ios) return null;

  const hasNav = loc.pathname !== "/login" && !isAdminContext;

  const handleClose = () => {
    dismissInstall();
  };

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome !== "unavailable") {
      // Either accepted (will fire appinstalled) or dismissed; close UI
      dismissInstall();
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-[55] pointer-events-none",
        hasNav ? "bottom-[84px] sm:bottom-[92px]" : "bottom-3"
      )}
      role="dialog"
      aria-live="polite"
      aria-label="Add KAYA to your home screen"
    >
      <div className="container-app px-3">
        <div className="pointer-events-auto relative bg-cream-50 border border-mustard-400/50 rounded-3xl shadow-hi p-4 sm:p-5 animate-fade-in-up">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full bg-charcoal-100 hover:bg-charcoal-200 text-charcoal-700 transition"
            aria-label="Dismiss install prompt"
          >
            <X size={14} />
          </button>

          <div className="flex items-start gap-3 pr-9">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-mustard-400 text-charcoal-900 display font-bold text-xl shadow-soft shrink-0">
              K
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-charcoal-900 leading-snug">
                {isAdminContext
                  ? "Add KAYA Ops to your home screen for faster access"
                  : "Add KAYA to your home screen for faster access"}{" "}
                <Heart
                  size={14}
                  className="inline align-baseline text-clay-400 -mb-0.5"
                  fill="currentColor"
                />
              </p>
              <p className="text-xs text-charcoal-400 mt-1">
                {isAdminContext
                  ? "Open the ops portal like a native app. Works offline."
                  : "Open like a native app. Works offline."}
              </p>
            </div>
          </div>

          {ios ? (
            <>
              <div className="mt-3.5 rounded-2xl bg-white border border-charcoal-100 p-3 text-xs text-charcoal-700 leading-relaxed">
                In Safari, tap{" "}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cream-100 font-semibold align-middle">
                  <Share size={11} /> Share
                </span>{" "}
                then{" "}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cream-100 font-semibold align-middle">
                  <Plus size={11} /> Add to Home Screen
                </span>
                .
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-outline flex-1 py-2.5 text-sm"
                >
                  Maybe later
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="btn-outline flex-1 py-2.5 text-sm"
              >
                Maybe later
              </button>
              <button
                type="button"
                onClick={handleInstall}
                className="btn-yellow flex-1 py-2.5 text-sm"
              >
                Add to Home Screen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
