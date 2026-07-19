import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { STORAGE_KEYS, saveJSON } from "@/lib/storage";
import { getRole } from "@/lib/permissions";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
} from "lucide-react";

type Mode = "signin" | "forgot";

/**
 * Hidden staff sign-in route at /staff-login. Not linked from any
 * customer-facing surface — accessed only by KAYA operators with the
 * direct URL. Supports password sign-in and email-based password reset.
 *
 * ⚠️ AUTH CONTRACT (2026-Q3):
 * Staff now authenticate via Supabase Auth (`signInWithPassword`) so
 * their browser holds a real JWT. The catalog RLS policies gate every
 * admin write behind `is_active_staff()`, which reads the caller's JWT
 * email and matches it against `staff_members`. Without a Supabase
 * session, ALL admin writes (products, shops, delivery areas, care
 * packages, vendors, orders, staff management) will be silently
 * rejected. Do NOT revert to the legacy app-layer password check.
 */
export default function StaffLogin() {
  const { customers, signInAs, requestPasswordReset } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setPassword("");
    setResetSent(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail.includes("@") || !cleanedEmail.includes(".")) {
      setError("Enter the staff email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);

    // Look up the local staff record (synced from staff_members) so
    // we can immediately restore the correct role after Supabase Auth
    // hands back a session. Staff records live alongside customers in
    // the `customers` array but always resolve to a non-customer role.
    const staffRecord = customers.find(
      (u) =>
        u.email.toLowerCase() === cleanedEmail && getRole(u) !== "customer"
    );

    // Delegate the credential check to Supabase Auth so the browser
    // ends up holding a real JWT for `is_active_staff()`.
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
    });

    if (authError || !data.user) {
      const raw = authError?.message ?? "Sign in failed.";
      const friendly = /invalid login credentials/i.test(raw)
        ? "Email or password is incorrect."
        : /email not confirmed/i.test(raw)
        ? "Email not confirmed yet — contact a Super Admin."
        : raw;
      setError(friendly);
      setSubmitting(false);
      return;
    }

    // The Auth user is genuine, but we still need a matching row in
    // `staff_members` to know their KAYA role (Ops vs Admin vs Super
    // Admin). Refuse sign-in and drop the fresh Supabase session if
    // they aren't provisioned as staff, so a customer with valid
    // credentials can't reach /admin via this route.
    if (!staffRecord) {
      await supabase.auth.signOut().catch(() => {});
      setError(
        "This account isn't provisioned for KAYA Ops. Contact a Super Admin."
      );
      setSubmitting(false);
      return;
    }

    // Pre-persist the staff identity to localStorage so the auth
    // listener in AppContext reads a non-customer user on its next
    // tick and short-circuits its customer-sync branch (which would
    // otherwise inject a phantom customer profile keyed to the Auth
    // user's UUID). signInAs then mirrors this into React state and
    // pushes the last-sign-in timestamp to Supabase.
    const updated = {
      ...staffRecord,
      lastSignInAt: new Date().toISOString(),
    };
    saveJSON(STORAGE_KEYS.user, updated);
    signInAs(updated);

    navigate("/admin", { replace: true });
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.includes("@") || !email.includes(".")) {
      setError("Enter the staff email address.");
      return;
    }
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't send reset link.");
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="min-h-screen bg-charcoal-900 text-cream-50 grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-cream-100/70 hover:text-cream-50 mb-6"
        >
          <ArrowLeft size={14} /> Customer sign in
        </button>

        <div className="card-base bg-charcoal-800 border-charcoal-700 text-cream-50 p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-mustard-400 text-charcoal-900">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-400">
                Internal access only
              </p>
              <h1 className="display text-2xl font-semibold leading-tight">
                {mode === "signin" ? "KAYA Ops sign in" : "Reset password"}
              </h1>
            </div>
          </div>

          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-cream-100/80">
                  Staff email
                </label>
                <div className="relative mt-1">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-100/50 pointer-events-none"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl bg-charcoal-900 border border-charcoal-700 pl-9 pr-3 py-3 text-sm placeholder:text-cream-100/30 focus:outline-none focus:border-mustard-400 focus:ring-2 focus:ring-mustard-400/30 transition"
                    placeholder="you@kayacare.com"
                    autoComplete="username"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-cream-100/80">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-[11px] font-semibold text-mustard-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
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
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-cream-100/60 hover:text-cream-50 hover:bg-cream-50/10 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
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
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-mustard-400 text-charcoal-900 px-4 py-3 text-sm font-bold shadow-sm hover:bg-mustard-500 transition disabled:opacity-60"
              >
                {submitting ? "Signing in…" : "Sign in to KAYA Ops"}
              </button>
            </form>
          )}

          {mode === "forgot" && !resetSent && (
            <form onSubmit={handleReset} className="space-y-3">
              <p className="text-xs text-cream-100/70 leading-relaxed -mt-1">
                Enter your staff email and we'll send a one-time reset link.
                Open the link on this device to choose a new password.
              </p>

              <div>
                <label className="text-xs font-semibold text-cream-100/80">
                  Staff email
                </label>
                <div className="relative mt-1">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-100/50 pointer-events-none"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl bg-charcoal-900 border border-charcoal-700 pl-9 pr-3 py-3 text-sm placeholder:text-cream-100/30 focus:outline-none focus:border-mustard-400 focus:ring-2 focus:ring-mustard-400/30 transition"
                    placeholder="you@kayacare.com"
                    autoComplete="username"
                    required
                    autoFocus
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
                disabled={submitting}
                className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-mustard-400 text-charcoal-900 px-4 py-3 text-sm font-bold shadow-sm hover:bg-mustard-500 transition disabled:opacity-60"
              >
                {submitting ? "Sending link…" : "Send reset link"}
              </button>

              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="w-full text-xs font-semibold text-cream-100/70 hover:text-cream-50 py-2"
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode === "forgot" && resetSent && (
            <div className="space-y-4 text-center">
              <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-sage-500 text-cream-50">
                <CheckCircle2 size={24} />
              </span>
              <div>
                <h2 className="display text-xl font-semibold">
                  Check your email
                </h2>
                <p className="text-sm text-cream-100/80 mt-1.5 leading-relaxed">
                  If an account exists for{" "}
                  <span className="font-semibold text-cream-50">{email}</span>,
                  we've sent a reset link. Open it on this device to set a new
                  password.
                </p>
              </div>
              <div className="rounded-2xl bg-charcoal-900/50 border border-charcoal-700 px-4 py-3 text-left">
                <p className="text-[10px] uppercase tracking-wider font-bold text-cream-100/60">
                  Didn't receive it?
                </p>
                <p className="text-[11px] text-cream-100/70 mt-1 leading-relaxed">
                  Reset emails take up to a minute. Check spam, or ask another
                  Super Admin to reset your password from the Staff tab.
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-mustard-400 text-charcoal-900 px-4 py-3 text-sm font-bold shadow-sm hover:bg-mustard-500 transition"
              >
                Back to sign in
              </button>
            </div>
          )}

          {mode === "signin" && (
            <p className="text-[11px] text-cream-100/45 mt-5 text-center">
              Customers can't see this page. Bookmark{" "}
              <span className="font-mono">/staff-login</span> for quick access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
