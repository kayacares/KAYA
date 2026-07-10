import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  Loader2,
  MessageCircleQuestion,
  MessagesSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import {
  getSupportStatus,
  loadTawk,
  openSupport,
  subscribeSupportStatus,
  type SupportStatus,
} from "@/lib/support";
import { cn } from "@/lib/utils";
import SupportStatusPill from "@/components/features/SupportStatusPill";

type SupportButtonVariant = "primary" | "outline" | "ghost" | "card";

interface SupportButtonProps {
  variant?: SupportButtonVariant;
  orderId?: string;
  orderStatus?: string;
  recipientName?: string;
  label?: string;
  className?: string;
}

const FALLBACK_TOAST_BODY =
  "Live chat couldn't load — likely a browser extension, ad-blocker or network block. Email contact@kaya.app or call +233 24 555 0100 and KAYA Operations will reply within an hour.";

const CHIP_LABEL: Record<SupportStatus, string> = {
  disabled: "Email us",
  loading: "Loading…",
  ready: "Chat now",
  fallback: "Email us",
};

export default function SupportButton({
  variant = "outline",
  orderId,
  orderStatus,
  recipientName,
  label = "Need help?",
  className,
}: SupportButtonProps) {
  const { user } = useApp();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SupportStatus>(() => getSupportStatus());

  useEffect(() => {
    // Kick off the Tawk script the moment the button mounts so a click a
    // few seconds later is more likely to find the widget ready.
    loadTawk();
    const unsubscribe = subscribeSupportStatus(setStatus);
    return unsubscribe;
  }, []);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const opened = await openSupport({
        name: user?.name,
        email: user?.email,
        phone: user?.phone,
        orderId,
        orderStatus,
        recipientName,
      });
      if (!opened) {
        toast("Reach KAYA support", {
          description: FALLBACK_TOAST_BODY,
          duration: 7000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (variant === "card") {
    const isOrder = !!orderId;
    const headline = isOrder
      ? "Need help with this order?"
      : "Talk to KAYA support";
    const sub = isOrder
      ? "We'll pass your order details along — no need to repeat yourself."
      : "Chat live with our team or send a quick message. We're here to help.";
    const chip = loading ? "Connecting…" : CHIP_LABEL[status];

    return (
      <div className={cn("space-y-1.5", className)}>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          aria-busy={loading}
          className="card-base p-4 w-full text-left flex items-center gap-3 hover:border-charcoal-400 hover:shadow-card transition group disabled:opacity-70 disabled:cursor-progress"
        >
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-sage-100 text-sage-700 shrink-0 group-hover:bg-sage-300 transition">
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <MessagesSquare size={18} />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-charcoal-900 leading-tight">
                {headline}
              </p>
              <SupportStatusPill />
            </div>
            <p className="text-xs text-charcoal-400 mt-0.5 leading-snug">
              {sub}
            </p>
          </div>
          <span className="chip bg-mustard-400 text-charcoal-900 text-[10px] shrink-0">
            {chip}
          </span>
        </button>
        <Link
          to="/help"
          className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-charcoal-400 hover:text-charcoal-900 transition"
        >
          <HelpCircle size={11} /> Browse the help center
        </Link>
      </div>
    );
  }

  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "ghost"
      ? "btn-ghost"
      : "btn-outline";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      className={cn(
        variantClass,
        className,
        loading && "opacity-70 cursor-progress"
      )}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <MessageCircleQuestion size={16} />
      )}{" "}
      {loading ? "Connecting…" : label}
    </button>
  );
}
