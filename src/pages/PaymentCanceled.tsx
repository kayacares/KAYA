import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";

export default function PaymentCanceled() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen grid place-items-center bg-cream-50 px-6">
      <div className="text-center max-w-md">
        <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-clay-400/15">
          <XCircle className="text-clay-500" size={26} />
        </span>
        <h1 className="display text-2xl font-semibold mt-4">Payment canceled</h1>
        <p className="text-sm text-charcoal-400 mt-2">
          Your cart is still here — whenever you're ready, head back to send care.
        </p>
        <div className="flex gap-2 mt-5 justify-center">
          <button
            onClick={() => navigate("/checkout", { replace: true })}
            className="btn-primary"
          >
            Back to checkout
          </button>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="btn-outline"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
