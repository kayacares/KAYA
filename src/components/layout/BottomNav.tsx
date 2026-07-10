import { NavLink, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Receipt, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";

const items = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/orders", label: "Orders", Icon: Receipt },
  { to: "/cart", label: "Cart", Icon: ShoppingBag },
  { to: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const loc = useLocation();
  const { cart } = useApp();
  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);

  if (loc.pathname.startsWith("/admin") || loc.pathname === "/login")
    return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-charcoal-100 safe-bottom">
      <div className="container-app px-2">
        <ul className="grid grid-cols-4">
          {items.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors relative",
                    isActive
                      ? "text-charcoal-900"
                      : "text-charcoal-400 hover:text-charcoal-700"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "relative grid place-items-center w-10 h-10 rounded-2xl transition-all",
                        isActive ? "bg-mustard-400" : "bg-transparent"
                      )}
                    >
                      <Icon size={18} strokeWidth={2.2} />
                      {to === "/cart" && cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] grid place-items-center bg-charcoal-800 text-cream-50 text-[10px] font-semibold rounded-full px-1">
                          {cartCount}
                        </span>
                      )}
                    </span>
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
