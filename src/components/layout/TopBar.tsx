import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/features/NotificationBell";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  transparent?: boolean;
  hideBell?: boolean;
}

export default function TopBar({
  title,
  subtitle,
  back,
  right,
  transparent,
  hideBell,
}: TopBarProps) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        "sticky top-0 z-30",
        transparent ? "bg-transparent" : "bg-cream-50/85 backdrop-blur-xl"
      )}
    >
      <div className="container-app px-4 py-3 flex items-center gap-3">
        {back && (
          <button
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="grid place-items-center w-10 h-10 rounded-2xl bg-white border border-charcoal-100 hover:bg-cream-100 transition"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h1 className="display text-xl font-semibold text-charcoal-900 truncate">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-xs text-charcoal-400 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          {!hideBell && <NotificationBell />}
        </div>
      </div>
    </header>
  );
}
