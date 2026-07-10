import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldAlert,
} from "lucide-react";

type Phase = "verifying" | "success" | "expired";

/**
 * Email verification landing page.
 * ------------------------------------------------------------
 * Supabase Auth sends the customer a signup verification email
 * that contains a link back to `${origin}/verify-email#access_token=...
 * &refresh_token=...&type=signup`. Because the Supabase client is
 * configured with `detectSessionInUrl: true`, opening that URL
 * causes the client to parse the tokens out of the hash, mint a
 * proper session and fire a `SIGNED_IN` event — no separate code
 * entry needed.
 *
 * This page:
 *   1. Watches for the `SIGNED_IN` event (or a pre-existing
 *      session from `getSession()`).
 *   2. Renders a friendly "verifying / verified / expired" state
 *      so the customer never lands on a blank page.
 *   3. Once the session is live, redirects to `/`. AppContext's
 *      global auth listener has already caught the same event and
 *      is syncing the customer profile in the background, so
 *      `RootGate` renders Home cleanly after the redirect.
 *
 * If Supabase never fires `SIGNED_IN` within 8 seconds the link is
 * either expired or already used — we surface an expired state with
 * clear next-step buttons so the customer is never stuck watching
 * a spinner.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [sessionActive, setSessionActive] = useState(false);

  // Watch for Supabase session activation. The tokens are in the
  // URL hash and Supabase's client auto-parses them on mount.
  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setSessionActive(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (event === "SIGNED_IN" && session) setSessionActive(true);
      }
    );

    // Expired / invalid link fallback — if Supabase never fires
    // SIGNED_IN we surface the expired state instead of an endless
    // spinner. 8s is comfortably long enough for the client to
    // parse the URL hash on any real-world connection.
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setPhase((p) => (p === "verifying" ? "expired" : p));
    }, 8000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  // Once verification succeeds, briefly show the success state so
  // the customer sees confirmation, then redirect home. AppContext's
  // global auth listener has already picked up the same SIGNED_IN
  // event and is syncing the customer profile in the background.
  useEffect(() => {
    if (!sessionActive) return;
    setPhase("success");
    toast.success("Email verified — welcome to KAYA!");
    const t = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [sessionActive, navigate]);

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
          <div className="card-base p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-mustard-400 text-charcoal-900 shadow-soft">
                <Mail size={18} />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-700">
                  Email verification
                </p>
                <h1 className="display text-2xl font-semibold text-charcoal-900 leading-tight">
                  {phase === "expired"
                    ? "Link expired"
                    : phase === "success"
                    ? "You\u2019re in"
                    : "Confirming your email"}
                </h1>
              </div>
            </div>

            {phase === "verifying" && (
              <div className="text-center py-6">
                <Loader2
                  className="mx-auto animate-spin text-mustard-600"
                  size={28}
                />
                <p className="text-sm text-charcoal-700 mt-3">
                  Verifying your email&hellip;
                </p>
                <p className="text-[11px] text-charcoal-400 mt-1">
                  You&rsquo;ll be signed in and taken to KAYA in a second.
                </p>
              </div>
            )}

            {phase === "success" && (
              <div className="space-y-4 text-center">
                <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-emerald-500 text-cream-50">
                  <CheckCircle2 size={24} />
                </span>
                <div>
                  <h2 className="display text-xl font-semibold text-charcoal-900">
                    Email verified
                  </h2>
                  <p className="text-sm text-charcoal-700 mt-1.5 leading-relaxed">
                    Signing you in and taking you to KAYA&hellip;
                  </p>
                </div>
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
                    Verification links work once and expire after 24
                    hours. Head to sign up to request a fresh link, or
                    sign in if your account is already verified.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/login?mode=signup")}
                  className="btn-yellow w-full"
                >
                  <ArrowRight size={16} /> Back to sign up
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/login?mode=signin")}
                  className="btn-outline w-full"
                >
                  I already have an account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
