import { useMemo } from "react";
import { Megaphone } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { REFERRAL_OPTIONS, REFERRAL_SOURCES } from "@/lib/referral";
import { cn } from "@/lib/utils";

/**
 * Admin Dashboard analytics card that breaks customers down by the
 * acquisition channel they reported in the post-onboarding prompt.
 * Used for marketing attribution — see which channels are bringing in
 * the most senders and which still need investment.
 */
export default function AcquisitionChannelsCard() {
  const { customers } = useApp();

  const summary = useMemo(() => {
    const customersOnly = customers.filter(
      (c) => (c.role ?? "customer") === "customer"
    );
    const counts = new Map<string, number>();
    let answered = 0;
    let skipped = 0;
    let pending = 0;

    for (const c of customersOnly) {
      if (c.referralSource) {
        counts.set(c.referralSource, (counts.get(c.referralSource) ?? 0) + 1);
        answered++;
      } else if (c.referralPromptedAt) {
        skipped++;
      } else {
        pending++;
      }
    }

    const ranked = REFERRAL_SOURCES.map((source) => ({
      source,
      count: counts.get(source) ?? 0,
    })).sort((a, b) => b.count - a.count);

    const max = Math.max(1, ...ranked.map((r) => r.count));
    const answeredPct =
      customersOnly.length > 0
        ? Math.round((answered / customersOnly.length) * 100)
        : 0;

    return {
      ranked,
      answered,
      skipped,
      pending,
      total: customersOnly.length,
      max,
      answeredPct,
    };
  }, [customers]);

  return (
    <section className="card-base p-4 mt-4">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-100 text-mustard-700 shrink-0"
            aria-hidden
          >
            <Megaphone size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="display text-base font-semibold leading-tight">
              Acquisition channels
            </h3>
            <p className="text-xs text-charcoal-400 leading-snug mt-0.5">
              How customers say they found KAYA
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="display font-bold text-xl tabular-nums leading-none">
            {summary.answered}
            <span className="text-charcoal-400 font-medium text-sm">
              /{summary.total}
            </span>
          </p>
          <p className="text-[10px] text-charcoal-400 uppercase tracking-wider font-semibold mt-0.5">
            Answered · {summary.answeredPct}%
          </p>
        </div>
      </header>

      {summary.answered === 0 ? (
        <div className="rounded-2xl bg-cream-100 px-4 py-6 text-center">
          <p className="text-sm text-charcoal-700 font-semibold">
            No responses yet
          </p>
          <p className="text-xs text-charcoal-400 mt-1 leading-snug">
            Customers will see an optional prompt after onboarding asking how
            they heard about KAYA. Responses appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {summary.ranked.map(({ source, count }) => {
            const cfg = REFERRAL_OPTIONS[source];
            const Icon = cfg.Icon;
            const pct = (count / summary.max) * 100;
            const sharePct =
              summary.answered > 0
                ? Math.round((count / summary.answered) * 100)
                : 0;
            return (
              <div key={source}>
                <div className="flex items-center justify-between text-xs mb-1 gap-2">
                  <span className="font-semibold flex items-center gap-1.5 min-w-0 text-charcoal-900">
                    <Icon size={12} className="shrink-0" />
                    <span className="truncate">{cfg.short}</span>
                  </span>
                  <span className="tabular-nums text-charcoal-700 shrink-0">
                    {count}
                    <span className="text-charcoal-400 font-medium ml-1">
                      · {sharePct}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-cream-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      cfg.bar
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(summary.skipped > 0 || summary.pending > 0) && (
        <div className="mt-3 pt-3 border-t border-charcoal-100 flex items-center justify-between text-[11px] text-charcoal-400 font-semibold uppercase tracking-wider">
          <span>{summary.skipped} skipped</span>
          <span>{summary.pending} not yet asked</span>
        </div>
      )}
    </section>
  );
}
