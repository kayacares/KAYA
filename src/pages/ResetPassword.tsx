import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
 * Customer password-recovery landing page. Supabase parses the
 * recovery token from the URL hash on mount (detectSessionInUrl:
 * true) and emits PASSWORD_RECOVERY. We wait for that event or an
 * active session, let the customer choose a new password, sign
 * them out of the recovery session and redirect back to /login so
 * they can sign in fresh with their new credentials.
 */
export default function ResetPassword() {
  const { completeCustomerPasswordReset } = useApp();
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

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (
          event === "PASSWORD_RECOVERY" ||
          (event === "SIGNED_IN" && session)
        ) {
          markReady();
        }
      }
    );

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
    const result = await completeCustomerPasswordReset(password);
    if (!result.ok) {
      setError(result.error ?? "Couldn't update password.");
      setPhase("ready");
      return;
    }
    setPhase("done");
    toast.success("Password updated — sign in with your new password.");
    window.setTimeout(
      () => navigate("/login", { replace: true }),
      1500
    );
  };

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col">
      <header className="w-full border-b border-charcoal-100/60">
        <div className="mx-auto max-w-md sm:max-w-lg px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2"
            aria-label="KAYA home"
          >
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-400 text-charcoal-900 display font-bold shadow-soft">
              K
            </div>
            <span className="display text-2xl font-semibold text-charcoal-900">
              KAYA
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center py-8 sm:py-12 px-4 sm:px-6">
        <div className="w-full max-w-md animate-fade-in-up">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-700 hover:text-charcoal-900 mb-4"
          >
            <ArrowLeft size={14} /> Back to sign in
          </button>

          <div className="card-base p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-mustard-400 text-charcoal-900 shadow-soft">
                <KeyRound size={18} />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-700">
                  Password reset
                </p>
                <h1 className="display text-2xl font-semibold text-charcoal-900 leading-tight">
                  Set a new password
                </h1>
              </div>
            </div>

            {phase === "checking" && (
              <div className="text-center py-6">
                <Loader2
                  className="mx-auto animate-spin text-mustard-600"
                  size={28}
                />
                <p className="text-sm text-charcoal-700 mt-3">
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
                  <h2 className="display text-xl font-semibold text-charcoal-900">
                    Link expired or invalid
                  </h2>
                  <p className="text-sm text-charcoal-700 mt-1.5 leading-relaxed">
                    Reset links work once and expire after 60 minutes.
                    Request a fresh one from the sign-in page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="btn-yellow w-full"
                >
                  Request a new link
                </button>
              </div>
            )}

            {(phase === "ready" || phase === "saving") && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-xs text-charcoal-700 leading-relaxed">
                  Choose a strong password with at least 8 characters.
                  You&rsquo;ll be signed out and asked to sign in again with
                  your new password.
                </p>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    New password
                  </label>
                  <div className="relative mt-1">
                    <KeyRound
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-base pl-10 pr-12"
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      autoComplete="new-password"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full text-charcoal-400 hover:text-charcoal-900 hover:bg-cream-100 transition"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    Confirm password
                  </label>
                  <div className="relative mt-1">
                    <KeyRound
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="input-base pl-10"
                      placeholder="Re-enter password"
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-[11px] mt-1 text-clay-600 font-semibold">
                      Passwords don&rsquo;t match yet
                    </p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-sm px-4 py-2.5"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={phase === "saving"}
                  className="btn-yellow w-full disabled:opacity-60"
                >
                  {phase === "saving" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} /> Update password
                    </>
                  )}
                </button>
              </form>
            )}

            {phase === "done" && (
              <div className="space-y-4 text-center">
                <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-emerald-500 text-cream-50">
                  <CheckCircle2 size={24} />
                </span>
                <div>
                  <h2 className="display text-xl font-semibold text-charcoal-900">
                    Password updated
                  </h2>
                  <p className="text-sm text-charcoal-700 mt-1.5 leading-relaxed">
                    Redirecting you to the sign-in page…
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
