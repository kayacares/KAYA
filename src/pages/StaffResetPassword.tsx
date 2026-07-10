import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

type Phase = "checking" | "ready" | "expired" | "saving" | "done";

/**
 * Landing page for Supabase Auth password recovery links. The Supabase
 * client (with detectSessionInUrl: true) parses the URL hash on mount
 * and emits PASSWORD_RECOVERY — we wait for that or a SIGNED_IN event,
 * then let the user set a new password.
 */
export default function StaffResetPassword() {
  const { completePasswordReset } = useApp();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      setPhase((p) => (p === "checking" ? "ready" : p));
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        markReady();
      }
    });

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setPhase((p) => (p === "checking" ? "expired" : p));
    }, 4000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPhase("saving");
    const result = await completePasswordReset(password);
    if (!result.ok) {
      setError(result.error ?? "Couldn't update password.");
      setPhase("ready");
      return;
    }
    setPhase("done");
    toast.success("Password updated. Sign in with your new password.");
    window.setTimeout(
      () => navigate("/staff-login", { replace: true }),
      1500
    );
  };

  return (
    <div className="min-h-screen bg-charcoal-900 text-cream-50 grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate("/staff-login")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-cream-100/70 hover:text-cream-50 mb-6"
        >
          <ArrowLeft size={14} /> Staff sign in
        </button>

        <div className="card-base bg-charcoal-800 border-charcoal-700 text-cream-50 p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-mustard-400 text-charcoal-900">
              <KeyRound size={18} />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-400">
                Password reset
              </p>
              <h1 className="display text-2xl font-semibold leading-tight">
                Set a new password
              </h1>
            </div>
          </div>

          {phase === "checking" && (
            <div className="text-center py-6">
              <Loader2
                className="mx-auto animate-spin text-mustard-400"
                size={28}
              />
              <p className="text-sm text-cream-100/70 mt-3">
                Verifying your reset link…
              </p>
            </div>
          )}

          {phase === "expired" && (
            <div className="space-y-4 text-center">
              <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-clay-400 text-cream-50">
                <ShieldAlert size={24} />
              </span>
              <div>
                <h2 className="display text-xl font-semibold">
                  Link expired or invalid
                </h2>
                <p className="text-sm text-cream-100/80 mt-1.5 leading-relaxed">
                  Reset links work for a single use and expire after 60
                  minutes. Request a fresh one from the staff sign-in page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/staff-login", { replace: true })}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-mustard-400 text-charcoal-900 px-4 py-3 text-sm font-bold shadow-sm hover:bg-mustard-500 transition"
              >
                Request a new link
              </button>
            </div>
          )}

          {(phase === "ready" || phase === "saving") && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs text-cream-100/70 leading-relaxed -mt-1">
                Choose a strong password with at least 8 characters. You'll be
                signed out and asked to sign in again.
              </p>

              <div>
                <label className="text-xs font-semibold text-cream-100/80">
                  New password
                </label>
                <div className="relative mt-1">
                  <KeyRound
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-100/50 pointer-events-none"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl bg-charcoal-900 border border-charcoal-700 pl-9 pr-12 py-3 text-sm placeholder:text-cream-100/30 focus:outline-none focus:border-mustard-400 focus:ring-2 focus:ring-mustard-400/30 transition"
                    placeholder="Min 8 characters"
                    minLength={8}
                    autoComplete="new-password"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-cream-100/60 hover:text-cream-50 hover:bg-cream-50/10 transition"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-cream-100/80">
                  Confirm password
                </label>
                <div className="relative mt-1">
                  <KeyRound
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-100/50 pointer-events-none"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-2xl bg-charcoal-900 border border-charcoal-700 pl-9 pr-3 py-3 text-sm placeholder:text-cream-100/30 focus:outline-none focus:border-mustard-400 focus:ring-2 focus:ring-mustard-400/30 transition"
                    placeholder="Re-enter password"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-300 text-sm px-4 py-2.5"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={phase === "saving"}
                className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-mustard-400 text-charcoal-900 px-4 py-3 text-sm font-bold shadow-sm hover:bg-mustard-500 transition disabled:opacity-60"
              >
                {phase === "saving" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} /> Update password
                  </>
                )}
              </button>
            </form>
          )}

          {phase === "done" && (
            <div className="space-y-4 text-center">
              <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-sage-500 text-cream-50">
                <CheckCircle2 size={24} />
              </span>
              <div>
                <h2 className="display text-xl font-semibold">
                  Password updated
                </h2>
                <p className="text-sm text-cream-100/80 mt-1.5 leading-relaxed">
                  Redirecting you to the staff sign-in page…
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
