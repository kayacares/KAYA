import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CreditCard,
  Gift,
  Heart,
  Package,
  PartyPopper,
  Store,
  Truck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Notification, NotificationType } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<NotificationType, { Icon: LucideIcon; accent: string }> = {
  order_confirmed: { Icon: Package, accent: "bg-mustard-100 text-mustard-700" },
  vendor_assigned: { Icon: Store, accent: "bg-sage-100 text-sage-700" },
  out_for_delivery: { Icon: Truck, accent: "bg-charcoal-800 text-cream-50" },
  delivered: { Icon: PartyPopper, accent: "bg-mustard-400 text-charcoal-900" },
  recipient_confirmed: { Icon: Heart, accent: "bg-clay-100 text-clay-600" },
  delivery_issue: { Icon: AlertTriangle, accent: "bg-clay-400 text-cream-50" },
  payment_update: { Icon: CreditCard, accent: "bg-sage-300 text-charcoal-900" },
  promotion: { Icon: Gift, accent: "bg-mustard-400 text-charcoal-900" },
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    user,
  } = useApp();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = (n: Notification) => {
    if (!n.read) markNotificationRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  // Guest guard — notifications require a user context and the bell
  // is only meaningful once the visitor is signed in. Called after
  // every hook so the rules-of-hooks are preserved.
  if (!user) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid place-items-center w-10 h-10 rounded-2xl border bg-white",
          "transition hover:bg-cream-100 focus:outline-none focus:ring-2 focus:ring-mustard-400/40",
          open ? "border-charcoal-400" : "border-charcoal-100"
        )}
      >
        <Bell size={18} className="text-charcoal-800" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 grid place-items-center rounded-full bg-mustard-400 text-charcoal-900 text-[10px] font-bold border-2 border-cream-50"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-charcoal-900/30 backdrop-blur-[2px]"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            className="fixed z-50 top-3 inset-x-3 sm:left-auto sm:right-4 sm:w-[22rem] max-h-[85vh] flex flex-col rounded-3xl bg-cream-50 border border-charcoal-100 shadow-hi overflow-hidden animate-scale-in"
          >
            <header className="px-4 py-3 flex items-center justify-between border-b border-charcoal-100 bg-white">
              <div className="min-w-0">
                <p className="display text-lg font-semibold text-charcoal-900">
                  Notifications
                </p>
                <p className="text-[11px] text-charcoal-400">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : "You're all caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-[11px] font-semibold text-charcoal-700 hover:text-charcoal-900 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-cream-100 transition"
                  >
                    <CheckCheck size={13} /> Mark all
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={() => setOpen(false)}
                  className="grid place-items-center w-8 h-8 rounded-full hover:bg-cream-100 text-charcoal-400 transition"
                >
                  <X size={15} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <span className="grid place-items-center w-12 h-12 mx-auto rounded-2xl bg-cream-100 text-mustard-600">
                    <Bell size={20} />
                  </span>
                  <p className="display text-base font-semibold mt-3">
                    No notifications yet.
                  </p>
                  <p className="text-xs text-charcoal-400 mt-1 max-w-[18rem] mx-auto">
                    We'll keep you updated on your orders and deliveries.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-charcoal-100">
                  {notifications.map((n) => {
                    const { Icon, accent } =
                      ICON_MAP[n.type] ?? ICON_MAP.promotion;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(n)}
                          className={cn(
                            "w-full text-left px-4 py-3 flex items-start gap-3 transition",
                            !n.read
                              ? "bg-mustard-100/40 hover:bg-mustard-100/70"
                              : "hover:bg-cream-100"
                          )}
                        >
                          <span
                            className={cn(
                              "grid place-items-center w-10 h-10 rounded-2xl shrink-0",
                              accent
                            )}
                            aria-hidden
                          >
                            <Icon size={16} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <p
                                className={cn(
                                  "text-sm leading-snug",
                                  n.read
                                    ? "text-charcoal-700 font-medium"
                                    : "text-charcoal-900 font-semibold"
                                )}
                              >
                                {n.title}
                              </p>
                              {!n.read && (
                                <span
                                  className="mt-1.5 w-2 h-2 rounded-full bg-mustard-500 shrink-0"
                                  aria-label="Unread"
                                />
                              )}
                            </div>
                            <p className="text-xs text-charcoal-400 line-clamp-2 mt-0.5">
                              {n.description}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold mt-1">
                              {relativeTime(n.createdAt)}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {notifications.length > 0 && (
              <footer className="px-3 py-2 border-t border-charcoal-100 bg-white">
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="w-full text-[11px] font-semibold text-charcoal-400 hover:text-clay-600 py-1.5 rounded-full transition"
                >
                  Clear all notifications
                </button>
              </footer>
            )}
          </div>
        </>
      )}
    </>
  );
}
