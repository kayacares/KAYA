import { useState } from "react";
import { Check, Copy, Gift, Share2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { REFERRAL_CREDIT_GHS } from "@/lib/referral";
import { formatCurrency } from "@/lib/currency";

/**
 * Profile-page "Refer a friend" module. Surfaces the user's unique
 * referral code, a one-tap copy/share affordance, and live stats
 * (friends joined + pending GH₵ credit). Every share interaction is
 * recorded via `recordReferralShare` so the admin Referrals card can
 * surface a most-shared channel breakdown.
 */
export default function ReferralCreditCard() {
  const { user, recordReferralShare } = useApp();
  const [copied, setCopied] = useState(false);

  if (!user?.referralCode) return null;

  const code = user.referralCode;
  const friendsJoined = user.referralsCount ?? 0;
  const pendingGHS = user.pendingCreditGHS ?? 0;
  const currency = user.currency ?? "GHS";
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/login?ref=${code}`
      : `/login?ref=${code}`;
  const shareText =
    `Join me on KAYA — care delivered to family in Ghana 💛 ` +
    `Use my code ${code} when you sign up and we'll both earn GH₵${REFERRAL_CREDIT_GHS} at launch.`;

  // Returns true if the clipboard write succeeded so the caller can
  // decide which channel to log.
  const writeShareMessage = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
      return true;
    } catch {
      toast.error("Couldn't copy — try the share button instead");
      return false;
    }
  };

  /** Direct click on the code chip — explicit "copy my code" intent. */
  const handleCopyCode = async () => {
    const ok = await writeShareMessage();
    if (ok) recordReferralShare("code_copy");
  };

  /** Share button — tries native Web Share API, falls back to clipboard. */
  const handleShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (
          navigator as Navigator & { share: typeof navigator.share }
        ).share({
          title: "Join me on KAYA",
          text: shareText,
          url: shareUrl,
        });
        recordReferralShare("share_api");
        return;
      } catch {
        // User dismissed the native sheet — record the intent and then
        // fall through so they can still copy.
        recordReferralShare("share_cancelled");
      }
    }
    const ok = await writeShareMessage();
    if (ok) recordReferralShare("clipboard");
  };

  return (
    <section className="card-base p-5 mb-4 relative overflow-hidden bg-mustard-100 border-mustard-400/60">
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-mustard-400/40 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0 shadow-soft">
            <Gift size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700">
              Refer a friend
            </p>
            <p className="display text-xl font-semibold text-charcoal-900 leading-tight mt-0.5">
              Share KAYA. Earn GH₵{REFERRAL_CREDIT_GHS}.
            </p>
            <p className="text-xs text-charcoal-700 mt-1 leading-relaxed">
              Friends who join with your code earn you GH₵{REFERRAL_CREDIT_GHS}{" "}
              credit when they place their first order at launch.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyCode}
          aria-label="Copy referral code"
          className="mt-4 w-full flex items-center gap-3 rounded-2xl bg-white border border-charcoal-100 px-4 py-3 hover:border-charcoal-400 transition group"
        >
          <span className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 shrink-0">
            Your code
          </span>
          <span className="flex-1 text-center display font-bold text-xl tracking-[0.4em] text-charcoal-900">
            {code}
          </span>
          <span className="grid place-items-center w-8 h-8 rounded-full bg-cream-100 text-charcoal-700 shrink-0 group-hover:bg-mustard-400 group-hover:text-charcoal-900 transition">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="btn-primary w-full mt-3"
        >
          <Share2 size={16} /> Share with a friend
        </button>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-2xl bg-white border border-charcoal-100 p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 flex items-center gap-1">
              <Users size={11} /> Friends joined
            </p>
            <p className="display text-2xl font-bold mt-0.5 tabular-nums">
              {friendsJoined}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-charcoal-100 p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 flex items-center gap-1">
              <Sparkles size={11} /> Pending credit
            </p>
            <p className="display text-2xl font-bold mt-0.5 tabular-nums">
              {formatCurrency(pendingGHS, currency)}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-charcoal-400 mt-3 leading-relaxed">
          Credit is applied automatically at checkout once KAYA launches in
          Accra & Tema. No expiry.
        </p>
      </div>
    </section>
  );
}
