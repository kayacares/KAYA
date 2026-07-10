import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  ClipboardCheck,
  ExternalLink,
  MessageCircleQuestion,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSupportConfigSummary,
  getSupportStatus,
  loadTawk,
  subscribeSupportStatus,
  type SupportStatus,
} from "@/lib/support";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<
  SupportStatus,
  { label: string; pill: string; dot: string }
> = {
  disabled: {
    label: "Not configured",
    pill: "bg-charcoal-100 text-charcoal-700",
    dot: "bg-charcoal-400",
  },
  loading: {
    label: "Connecting…",
    pill: "bg-mustard-100 text-charcoal-700",
    dot: "bg-mustard-400 animate-pulse",
  },
  ready: {
    label: "Live chat online",
    pill: "bg-sage-100 text-sage-700",
    dot: "bg-sage-700",
  },
  fallback: {
    label: "Email & phone only",
    pill: "bg-clay-100 text-clay-600",
    dot: "bg-clay-400",
  },
};

/**
 * Admin-only diagnostics card for the embedded Tawk.to live chat
 * integration. Surfaces the current Property/Widget IDs, validates
 * their format, shows whether they came from .env or fallback, and
 * walks staff through exactly where to paste new values.
 */
export default function SupportConfigNote() {
  const summary = getSupportConfigSummary();
  const [status, setStatus] = useState<SupportStatus>(() => getSupportStatus());
  const [copied, setCopied] = useState<"prop" | "wid" | null>(null);
  const [howOpen, setHowOpen] = useState(!summary.configured);

  useEffect(() => {
    loadTawk();
    return subscribeSupportStatus(setStatus);
  }, []);

  const palette = STATUS_STYLE[status];

  const copy = async (value: string, key: "prop" | "wid") => {
    if (!value) {
      toast.error("Nothing to copy — this field is empty");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy — please copy manually");
    }
  };

  return (
    <section className="card-base p-4 mt-4">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              "grid place-items-center w-10 h-10 rounded-2xl shrink-0",
              summary.configured
                ? "bg-sage-100 text-sage-700"
                : "bg-clay-100 text-clay-600"
            )}
            aria-hidden
          >
            <MessageCircleQuestion size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="display text-base font-semibold leading-tight">
              Tawk.to live chat
            </h3>
            <p className="text-xs text-charcoal-400 leading-snug mt-0.5">
              KAYA Operations customer support integration
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 whitespace-nowrap",
            palette.pill
          )}
          role="status"
          aria-live="polite"
        >
          <span
            className={cn("w-1.5 h-1.5 rounded-full shrink-0", palette.dot)}
            aria-hidden
          />
          {palette.label}
        </span>
      </header>

      <div className="grid gap-2 mb-3">
        <ConfigRow
          label="Property ID"
          value={summary.propertyId}
          valid={summary.propertyIdValid}
          source={summary.propertySource}
          onCopy={() => copy(summary.propertyId, "prop")}
          copied={copied === "prop"}
          hint="24-character hex (e.g. 6a385779…6b)"
        />
        <ConfigRow
          label="Widget ID"
          value={summary.widgetId}
          valid={summary.widgetIdValid}
          source={summary.widgetSource}
          onCopy={() => copy(summary.widgetId, "wid")}
          copied={copied === "wid"}
          hint='Alphanumeric (e.g. 1jrm1bddn) — never the literal "default"'
        />
      </div>

      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        aria-expanded={howOpen}
        className="w-full rounded-2xl bg-cream-100 hover:bg-cream-200 transition px-3 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-charcoal-800"
      >
        Where do I paste these IDs?
        <ChevronDown
          size={14}
          className={cn(
            "text-charcoal-400 transition-transform shrink-0",
            howOpen && "rotate-180"
          )}
        />
      </button>

      {howOpen && (
        <div className="mt-3 space-y-3 text-xs text-charcoal-700 leading-relaxed">
          <div>
            <p className="font-semibold text-charcoal-900">
              Option 1 — environment variables (preferred)
            </p>
            <p className="mt-1">
              Add these lines to your{" "}
              <code className="px-1 py-0.5 bg-cream-100 rounded">.env</code>{" "}
              file at the project root, then rebuild:
            </p>
            <pre className="bg-charcoal-900 text-cream-50 text-[11px] rounded-xl p-3 overflow-x-auto leading-relaxed mt-2">
              <code>{`VITE_TAWK_PROPERTY_ID=your-property-id\nVITE_TAWK_WIDGET_ID=your-widget-id`}</code>
            </pre>
          </div>

          <div>
            <p className="font-semibold text-charcoal-900">
              Option 2 — edit the file directly
            </p>
            <p className="mt-1">
              Open{" "}
              <code className="px-1 py-0.5 bg-cream-100 rounded">
                src/lib/support.ts
              </code>{" "}
              and update{" "}
              <code className="px-1 py-0.5 bg-cream-100 rounded">
                FALLBACK_PROPERTY_ID
              </code>{" "}
              and{" "}
              <code className="px-1 py-0.5 bg-cream-100 rounded">
                FALLBACK_WIDGET_ID
              </code>{" "}
              near the top of the file.
            </p>
          </div>

          <div>
            <p className="font-semibold text-charcoal-900">
              Find your IDs in Tawk.to
            </p>
            <ol className="list-decimal pl-5 space-y-1 mt-1">
              <li>
                Sign in at{" "}
                <a
                  href="https://dashboard.tawk.to"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-charcoal-900 font-semibold inline-flex items-center gap-1 hover:underline"
                >
                  dashboard.tawk.to
                  <ExternalLink size={10} />
                </a>
              </li>
              <li>
                Open{" "}
                <span className="font-semibold">
                  Administration → Channels → Chat Widget
                </span>
              </li>
              <li>
                Find the line in the embed snippet that reads{" "}
                <code className="px-1 py-0.5 bg-cream-100 rounded text-[10px]">
                  s1.src='https://embed.tawk.to/PROPERTY/WIDGET'
                </code>{" "}
                — paste those two values above.
              </li>
            </ol>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-charcoal-100">
        {summary.configured ? (
          <p className="text-[11px] text-charcoal-400 flex items-start gap-1.5 leading-snug">
            <CheckCircle2
              size={12}
              className="text-sage-700 shrink-0 mt-0.5"
            />
            <span className="min-w-0">
              IDs look valid. Embed URL:{" "}
              <a
                href={summary.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-charcoal-700 font-mono underline break-all"
              >
                {summary.embedUrl.replace("https://", "")}
              </a>
            </span>
          </p>
        ) : (
          <p className="text-[11px] text-clay-600 flex items-start gap-1.5 leading-snug">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>
              One or both IDs are missing or have the wrong format. Support
              cards will fall back to email + phone until this is fixed.
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

function ConfigRow({
  label,
  value,
  valid,
  source,
  onCopy,
  copied,
  hint,
}: {
  label: string;
  value: string;
  valid: boolean;
  source: "env" | "fallback";
  onCopy: () => void;
  copied: boolean;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-cream-100 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">
          <span>{label}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-wider",
              source === "env"
                ? "bg-sage-100 text-sage-700"
                : "bg-mustard-100 text-mustard-700"
            )}
          >
            {source === "env" ? ".env" : "fallback"}
          </span>
        </div>
        <p className="font-mono text-xs text-charcoal-900 truncate mt-0.5">
          {value || "(empty)"}
        </p>
        <p className="text-[10px] text-charcoal-400 mt-0.5 truncate">{hint}</p>
      </div>
      <span
        className="grid place-items-center w-6 h-6 shrink-0"
        title={valid ? "Format valid" : "Format invalid"}
        aria-label={valid ? "Format valid" : "Format invalid"}
      >
        {valid ? (
          <CheckCircle2 size={14} className="text-sage-700" />
        ) : (
          <AlertTriangle size={14} className="text-clay-600" />
        )}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className="grid place-items-center w-7 h-7 rounded-xl bg-white text-charcoal-700 hover:bg-charcoal-900 hover:text-cream-50 transition shrink-0"
        aria-label={`Copy ${label}`}
      >
        {copied ? <ClipboardCheck size={12} /> : <Clipboard size={12} />}
      </button>
    </div>
  );
}
