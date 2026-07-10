import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import { loadTawk } from "@/lib/support";

export default function AppLayout() {
  useEffect(() => {
    // Lazy-load the Tawk.to embed once an authenticated route mounts so that
    // tapping "Need help?" in Profile or Order Detail opens chat instantly.
    loadTawk();
  }, []);

  return (
    <div className="min-h-screen bg-cream-50 text-charcoal-800">
      <div className="pb-28">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
