import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] bg-clay-400 text-cream-50 shadow-card animate-fade-in-up"
      role="status"
      aria-live="polite"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container-app px-4 py-2 text-xs sm:text-sm font-semibold text-center">
        <span className="inline-flex items-center gap-1.5">
          <WifiOff size={13} />
          You're offline — care can wait. We'll sync when you're back.
        </span>
      </div>
    </div>
  );
}
