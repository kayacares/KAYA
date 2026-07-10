import { useEffect, useState } from "react";
import { Download, Plus, Share, X } from "lucide-react";
import {
  hasInstallPrompt,
  isAndroid,
  isIOS,
  isInstalled,
  onPwaChange,
  promptInstall,
} from "@/lib/pwa";

interface InstallAppButtonProps {
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

/**
 * Always-available "Install app" trigger. Unlike the auto InstallPrompt
 * banner (which depends on Chrome firing `beforeinstallprompt`), this
 * button is unconditionally visible whenever the app isn't yet installed.
 *
 * Click behaviour:
 *  · Native prompt available  → fires `promptInstall()`
 *  · iOS Safari               → opens Share → Add to Home Screen guide
 *  · Anything else            → opens browser-specific instructions
 */
export default function InstallAppButton({
  label = "Install app",
  className,
  iconOnly = false,
}: InstallAppButtonProps) {
  const [, force] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => onPwaChange(() => force((t) => t + 1)), []);

  if (isInstalled()) return null;

  const handleClick = async () => {
    if (hasInstallPrompt()) {
      const outcome = await promptInstall();
      if (outcome === "unavailable") setShowHelp(true);
      return;
    }
    setShowHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-full bg-cream-50/10 hover:bg-cream-50/20 text-cream-50 px-3 py-1.5 text-xs font-semibold transition"
        }
        aria-label={label}
        title={label}
      >
        <Download size={13} />
        {!iconOnly && <span>{label}</span>}
      </button>
      {showHelp && <InstallHelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}

function InstallHelpModal({ onClose }: { onClose: () => void }) {
  const ios = isIOS();
  const android = isAndroid();
  const desktop = !ios && !android;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-charcoal-900/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-help-title"
        className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-full bg-charcoal-100 hover:bg-charcoal-200 text-charcoal-700 transition"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3 mb-4 pr-9">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-mustard-400 text-charcoal-900 display font-bold text-xl shadow-soft shrink-0">
            K
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700">
              Add to home screen
            </p>
            <h3
              id="install-help-title"
              className="display text-xl font-semibold leading-tight"
            >
              Install KAYA Ops
            </h3>
            <p className="text-xs text-charcoal-400 mt-1 leading-snug">
              Run the ops portal like a native app. Works offline once
              installed.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {ios && (
            <Steps
              platform="iOS Safari"
              steps={[
                <>
                  Tap the{" "}
                  <Pill>
                    <Share size={11} /> Share
                  </Pill>{" "}
                  button in the Safari toolbar.
                </>,
                <>
                  Scroll and tap{" "}
                  <Pill>
                    <Plus size={11} /> Add to Home Screen
                  </Pill>
                  .
                </>,
                <>Confirm the name "KAYA Ops" and tap Add.</>,
              ]}
            />
          )}
          {android && (
            <Steps
              platform="Android Chrome"
              steps={[
                <>
                  Tap the <Pill>⋮ menu</Pill> in the top right of Chrome.
                </>,
                <>
                  Choose <Pill>Install app</Pill> (or "Add to Home Screen").
                </>,
                <>Tap Install to confirm.</>,
              ]}
            />
          )}
          {desktop && (
            <>
              <Steps
                platform="Chrome / Edge desktop"
                steps={[
                  <>
                    Look for the install icon{" "}
                    <Pill>
                      <Download size={11} />
                    </Pill>{" "}
                    on the right edge of the address bar — click it.
                  </>,
                  <>
                    Or open the <Pill>⋮ menu</Pill> →{" "}
                    <Pill>Cast, save and share</Pill> →{" "}
                    <Pill>Install KAYA Ops</Pill>.
                  </>,
                  <>Click Install to pin it to your dock or taskbar.</>,
                ]}
              />
              <Steps
                platform="Safari desktop"
                steps={[
                  <>
                    Open the <Pill>File</Pill> menu in Safari.
                  </>,
                  <>
                    Choose <Pill>Add to Dock…</Pill>
                  </>,
                  <>Confirm the name "KAYA Ops" and click Add.</>,
                ]}
              />
            </>
          )}
        </div>

        <div className="mt-5 rounded-2xl bg-cream-100 border border-charcoal-100/60 p-3 text-[11px] text-charcoal-700 leading-relaxed">
          <span className="font-semibold text-charcoal-900">Tip:</span> If
          you don't see the install option, refresh once and interact with
          the page for a few seconds — browsers wait for engagement before
          enabling install.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-outline mt-4 w-full"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Steps({
  platform,
  steps,
}: {
  platform: string;
  steps: React.ReactNode[];
}) {
  return (
    <div className="card-base p-4">
      <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-2">
        {platform}
      </p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-charcoal-700">
            <span className="grid place-items-center w-6 h-6 rounded-full bg-mustard-400 text-charcoal-900 text-[11px] font-bold shrink-0">
              {i + 1}
            </span>
            <span className="leading-snug pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cream-100 border border-charcoal-100 font-semibold align-middle text-[11px]">
      {children}
    </span>
  );
}
