import { useMemo } from "react";
import { Clipboard, Copy, Gift, Share2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { REFERRAL_CREDIT_GHS } from "@/lib/referral";
import { formatGHS } from "@/lib/currency";
import type { ReferralShareChannel } from "@/types";

const CHANNEL_LABEL: Record<ReferralShareChannel, string> = {
  share_api: "Native share",
  clipboard: "Clipboard",
  code_copy: "Code copy",
  share_cancelled: "Cancelled",
};

const CHANNEL_ICON: Record<ReferralShareChannel, LucideIcon> = {
  share_api: Share2,
  clipboard: Clipboard,
  code_copy: Copy,
  share_cancelled: Share2,
};

// Channels that count toward the share-volume total — `share_cancelled`
// records intent only and is intentionally excluded from headline counts.
const VISIBLE_CHANNELS: ReferralShareChannel[] = [
  "share_api",
  "clipboard",
  "code_copy",
];

/**
 * Admin dashboard card summarising refer-a-friend performance — total
 * referrals, pending GH₵ credit owed at launch, share-activity
 * breakdown by channel, and top referrers.
 */
export default function ReferralsCard() {
  const { customers, waitlistEntries, referralShares } = useApp();

  const summary = useMemo(() => {
    const customersOnly = customers.filter(
      (c) => (c.role ?? "customer") === "customer"
    );
    let totalReferrals = 0;
    let totalPendingGHS = 0;
    const ranked = customersOnly
      .map((c) => ({
        id: c.id,
        name: c.name,
        code: c.referralCode ?? "",
        referrals: c.referralsCount ?? 0,
        credit: c.pendingCreditGHS ?? 0,
      }))
      .filter((c) => c.referrals > 0)
      .sort((a, b) => b.referrals - a.referrals)
      .slice(0, 5);

    for (const c of customersOnly) {
      totalReferrals += c.referralsCount ?? 0;
      totalPendingGHS += c.pendingCreditGHS ?? 0;
    }

    const referredViaCode = waitlistEntries.filter(
      (w) => !!w.referredByCode
    ).length;

    return {
      totalReferrals,
      totalPendingGHS,
      ranked,
      referredViaCode,
    };
  }, [customers, waitlistEntries]);

  const shareStats = useMemo(() => {
    const breakdown: Record<ReferralShareChannel, number> = {
      share_api: 0,
      clipboard: 0,
      code_copy: 0,
      share_cancelled: 0,
    };
    for (const s of referralShares) breakdown[s.channel]++;
    const total = VISIBLE_CHANNELS.reduce((sum, ch) => sum + breakdown[ch], 0);
    let topChannel: ReferralShareChannel = "share_api";
    let topCount = -1;
    for (const ch of VISIBLE_CHANNELS) {
      if (breakdown[ch] > topCount) {
        topCount = breakdown[ch];
        topChannel = ch;
      }
    }
    const uniqueSharers = new Set(referralShares.map((s) => s.userId)).size;
    return { breakdown, total, topChannel, topCount, uniqueSharers };
  }, [referralShares]);

  const TopChannelIcon = CHANNEL_ICON[shareStats.topChannel];

  return (
    <section className="card-base p-4 mt-4">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0"
            aria-hidden
          >
            <Gift size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="display text-base font-semibold leading-tight">
              Refer-a-friend
            </h3>
            <p className="text-xs text-charcoal-400 leading-snug mt-0.5">
              GH₵{REFERRAL_CREDIT_GHS} credit per successful referral
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="display font-bold text-xl tabular-nums leading-none">
            {summary.totalReferrals}
          </p>
          <p className="text-[10px] text-charcoal-400 uppercase tracking-wider font-semibold mt-0.5">
            Referrals
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-2xl bg-cream-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">
            Pending credit
          </p>
          <p className="display text-xl font-bold mt-1 tabular-nums">
            {formatGHS(summary.totalPendingGHS)}
          </p>
        </div>
        <div className="rounded-2xl bg-cream-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">
            Waitlist via code
          </p>
          <p className="display text-xl font-bold mt-1 tabular-nums">
            {summary.referredViaCode}
          </p>
        </div>
      </div>

      {/* Share activity ------------------------------------------------ */}
      <div className="rounded-2xl bg-cream-100 p-3 mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] uppercase tracking-wider text-charcoal-400 font-semibold flex items-center gap-1">
            <Share2 size={11} /> Share activity
          </p>
          <span className="text-[10px] text-charcoal-400 font-semibold tabular-nums">
            {shareStats.uniqueSharers}{" "}
            {shareStats.uniqueSharers === 1 ? "sharer" : "sharers"}
          </span>
        </div>
        {shareStats.total === 0 ? (
          <p className="text-xs text-charcoal-400 leading-snug py-2">
            No shares yet — once customers tap share or copy in the Profile
            referral card, the most-shared channel will surface here.
          </p>
        ) : (
          <>
            <div className="rounded-xl bg-mustard-400 text-charcoal-900 p-3 mb-2 flex items-center gap-3">
              <span
                className="grid place-items-center w-10 h-10 rounded-xl bg-charcoal-900 text-mustard-400 shrink-0"
                aria-hidden
              >
                <TopChannelIcon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">
                  Most-shared channel
                </p>
                <p className="display font-semibold text-base leading-tight tabular-nums truncate">
                  {CHANNEL_LABEL[shareStats.topChannel]} ·{" "}
                  {shareStats.topCount}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="display font-bold text-xl tabular-nums leading-none">
                  {shareStats.total}
                </p>
                <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
                  Total
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {VISIBLE_CHANNELS.map((ch) => {
                const Icon = CHANNEL_ICON[ch];
                const count = shareStats.breakdown[ch];
                const pct =
                  shareStats.total > 0
                    ? Math.round((count / shareStats.total) * 100)
                    : 0;
                const isTop =
                  count === shareStats.topCount && shareStats.total > 0;
                return (
                  <div
                    key={ch}
                    className={`rounded-xl border p-2 ${
                      isTop
                        ? "bg-white border-mustard-400/60"
                        : "bg-white border-charcoal-100"
                    }`}
                  >
                    <p className="text-[10px] text-charcoal-400 uppercase tracking-wider font-semibold flex items-center gap-1 truncate">
                      <Icon size={10} className="shrink-0" />
                      <span className="truncate">{CHANNEL_LABEL[ch]}</span>
                    </p>
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <p className="display font-bold text-lg tabular-nums leading-none">
                        {count}
                      </p>
                      <p className="text-[10px] text-charcoal-400 font-semibold tabular-nums">
                        {pct}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {shareStats.breakdown.share_cancelled > 0 && (
              <p className="text-[10px] text-charcoal-400 mt-2 leading-snug">
                {shareStats.breakdown.share_cancelled} additional native share
                sheet{shareStats.breakdown.share_cancelled === 1 ? "" : "s"}{" "}
                opened then dismissed.
              </p>
            )}
          </>
        )}
      </div>

      {summary.ranked.length === 0 ? (
        <div className="rounded-2xl bg-cream-100 px-4 py-6 text-center">
          <p className="text-sm text-charcoal-700 font-semibold">
            No referrals yet
          </p>
          <p className="text-xs text-charcoal-400 mt-1 leading-snug">
            When customers share their referral code and friends sign up
            using it, top referrers will appear here.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-charcoal-400 font-semibold mb-2 flex items-center gap-1">
            <Users size={11} /> Top referrers
          </p>
          <div className="space-y-1.5">
            {summary.ranked.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-cream-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{c.name}</p>
                  <p className="text-[10px] text-charcoal-400 font-mono">
                    {c.code}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="display text-base font-bold tabular-nums leading-none">
                    {c.referrals}
                  </p>
                  <p className="text-[10px] text-charcoal-400 font-semibold">
                    {formatGHS(c.credit)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
