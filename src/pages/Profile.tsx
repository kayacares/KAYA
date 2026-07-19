import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import {
  ArrowRight,
  BadgeCheck,
  HelpCircle,
  Loader2,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import CurrencySelector from "@/components/features/CurrencySelector";
import SupportButton from "@/components/features/SupportButton";
import ReferralCreditCard from "@/components/features/ReferralCreditCard";
import type { UserRole } from "@/types";

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Customer",
  ops: "Operations Coordinator",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_STYLE: Record<UserRole, string> = {
  customer: "bg-cream-200 text-charcoal-700",
  ops: "bg-sage-300 text-charcoal-900",
  admin: "bg-mustard-400 text-charcoal-900",
  super_admin: "bg-charcoal-900 text-cream-50",
};

/**
 * Inline "Verify your email" card shown on Profile when the current
 * customer has `emailVerified: false`. Offers two paths that match
 * whatever the Supabase email template is configured to send:
 *   1. Enter the numeric OTP code from the email.
 *   2. Resend the confirmation email (which may contain a link the
 *      user opens from another device or a numeric code they type
 *      here).
 * Nothing is blocked — the customer can dismiss and keep using KAYA;
 * this section just makes it easy to verify at their convenience.
 */
function VerifyEmailCard({ email }: { email: string }) {
  const { verifyEmailWithCode, resendEmailVerification } = useApp();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleaned = code.trim();
    if (!/^\d{4,8}$/.test(cleaned)) {
      setError("Enter the numeric code from your verification email.");
      return;
    }
    setVerifying(true);
    const result = await verifyEmailWithCode(cleaned);
    setVerifying(false);
    if (!result.ok) {
      setError(result.error ?? "Verification failed.");
      return;
    }
    toast.success("Email verified — thanks!");
    setCode("");
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    const result = await resendEmailVerification(email);
    setResending(false);
    if (!result.ok) {
      const raw = result.error ?? "Couldn't resend the email.";
      setError(raw);
      toast.error(raw);
      return;
    }
    toast.success("Verification email resent — check your inbox.");
  };

  return (
    <section className="card-base p-4 mb-4 bg-mustard-100 border-mustard-400/40">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white text-mustard-700 shrink-0 shadow-soft">
          <ShieldAlert size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-700">
            Verify your email
          </p>
          <p className="font-semibold text-sm text-charcoal-900 mt-0.5">
            Confirm{" "}
            <span className="font-bold">{email}</span>
          </p>
          <p className="text-[11px] text-charcoal-700 mt-1 leading-snug">
            You can keep using KAYA — verifying protects your account
            and unlocks password recovery.
          </p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
          }
          className="input-base flex-1 tracking-[0.35em] font-semibold text-center"
          placeholder="Enter code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
        />
        <button
          type="submit"
          disabled={verifying || code.length < 4}
          className="rounded-2xl bg-charcoal-900 hover:bg-charcoal-700 text-cream-50 px-4 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {verifying ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            "Verify"
          )}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-2 text-[11px] font-semibold text-clay-600"
        >
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <p className="text-charcoal-700 leading-snug">
          Sent a link instead of a code?{" "}
          <span className="font-semibold text-charcoal-900">
            Tap the link
          </span>{" "}
          in the email to verify.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white border border-mustard-400/60 hover:border-mustard-500 text-charcoal-900 px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50"
        >
          {resending ? (
            <>
              <Loader2 size={11} className="animate-spin" /> Sending
            </>
          ) : (
            <>
              <Mail size={11} /> Resend
            </>
          )}
        </button>
      </div>
    </section>
  );
}

export default function Profile() {
  const { user, logout, recipients, orders } = useApp();
  const navigate = useNavigate();

  if (!user) return null;

  const role: UserRole = user.role ?? (user.isAdmin ? "admin" : "customer");
  const isStaff = role !== "customer";
  const isEmailVerified = user.emailVerified !== false;

  const myOrders = orders.filter((o) => o.senderId === user.id);
  const totalSentGHS = myOrders.reduce((s, o) => s + o.totalGHS, 0);

  return (
    <>
      <TopBar title="Profile" right={<CurrencySelector />} />
      <main className="container-app px-4 pb-10">
        <section className="card-base p-5 mb-4 bg-charcoal-800 text-cream-50 border-charcoal-700">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-14 h-14 rounded-2xl bg-mustard-400 text-charcoal-900 display text-2xl font-bold">
              {(user.firstName?.[0] ?? user.name[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="display text-xl font-semibold truncate">
                {user.name}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs text-cream-100/70 truncate">
                  {user.email}
                </p>
                {!isStaff &&
                  (isEmailVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      <BadgeCheck size={10} /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mustard-400/20 text-mustard-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      <ShieldAlert size={10} /> Unverified
                    </span>
                  ))}
              </div>
              <p className="text-xs text-cream-100/70 truncate">
                {user.country}
              </p>
              <span className={`chip text-[10px] mt-2 ${ROLE_STYLE[role]}`}>
                {isStaff && <ShieldCheck size={11} />}
                {ROLE_LABEL[role]}
              </span>
            </div>
          </div>
          {!isStaff && (
            <div className="grid grid-cols-3 gap-2 mt-5">
              {[
                { l: "Loved ones", v: recipients.length },
                { l: "Care sent", v: myOrders.length },
                { l: "Total GH₵", v: totalSentGHS.toFixed(0) },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-2xl bg-cream-50/10 p-3 text-center"
                >
                  <p className="display text-xl font-bold">{s.v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-cream-100/70">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {!isStaff && !isEmailVerified && <VerifyEmailCard email={user.email} />}

        {!isStaff && <ReferralCreditCard />}

        <section className="card-base p-2 mb-4 divide-y divide-charcoal-100">
          <Link
            to="/recipients"
            className="flex items-center gap-3 p-3 hover:bg-cream-100 rounded-2xl"
          >
            <Users size={18} className="text-charcoal-700" />
            <span className="font-medium text-sm flex-1">Recipients</span>
            <ArrowRight size={14} className="text-charcoal-400" />
          </Link>
          <Link
            to="/help"
            className="flex items-center gap-3 p-3 hover:bg-cream-100 rounded-2xl"
          >
            <HelpCircle size={18} className="text-charcoal-700" />
            <span className="font-medium text-sm flex-1">Help Center</span>
            <span className="chip bg-sage-100 text-sage-700 text-[10px]">FAQs</span>
            <ArrowRight size={14} className="text-charcoal-400" />
          </Link>
        </section>

        {/* KAYA is a Ghana-first, GHS-only marketplace at launch —
            surfaced here so customers understand why the display
            currency is fixed regardless of their home country. */}
        {!isStaff && (
          <section className="card-base p-4 mb-4 bg-cream-100 border-charcoal-100/60">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white text-mustard-600 shrink-0 display font-bold text-sm">
                GH₵
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-charcoal-900">
                  All prices shown in Ghana Cedis
                </p>
                <p className="text-[11px] text-charcoal-700 leading-snug mt-1">
                  KAYA charges in GH₵ so what you see is what you pay.
                  Your bank or card provider may convert this charge
                  into your local currency.
                </p>
              </div>
            </div>
          </section>
        )}

        <SupportButton variant="card" className="mb-4" />

        <button
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="btn-outline w-full text-clay-600 border-clay-400/30"
        >
          <LogOut size={16} /> Sign out
        </button>
      </main>
    </>
  );
}
