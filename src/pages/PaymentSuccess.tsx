import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Stripe redirect target. KAYA is in pre-launch and does not redirect to
 * Stripe — if a user somehow lands here (e.g. an in-flight session from
 * an older build), bounce them home with a friendly explanation.
 */
export default function PaymentSuccess() {
  const navigate = useNavigate();
  useEffect(() => {
    // Clear any stale pending order state from previous builds.
    try {
      sessionStorage.removeItem("kaya.pendingOrder");
    } catch {
      /* ignore */
    }
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-cream-50 px-6">
      <div className="text-center max-w-md">
        <h1 className="display text-2xl font-semibold text-charcoal-900">
          KAYA is preparing for launch
        </h1>
        <p className="text-sm text-charcoal-400 mt-2">
          Taking you back home…
        </p>
      </div>
    </div>
  );
}
