/**
 * KAYA customer support — embedded Tawk.to live chat.
 *
 * ─────────────────────────────────────────────────────────────────────
 *  Configuration
 * ─────────────────────────────────────────────────────────────────────
 *
 * Preferred — set Vite env vars in `.env` (requires app rebuild):
 *
 *     VITE_TAWK_PROPERTY_ID=<your-property-id>
 *     VITE_TAWK_WIDGET_ID=<your-widget-id>
 *
 * Or — paste them directly into the FALLBACK_* constants below.
 *
 * Where to find them:
 *   1. Sign in to https://dashboard.tawk.to
 *   2. Administration → Channels → Chat Widget
 *   3. In the embed snippet find the line:
 *        s1.src = 'https://embed.tawk.to/<PROPERTY_ID>/<WIDGET_ID>';
 *      Copy each value into the matching slot.
 *
 * ─────────────────────────────────────────────────────────────────────
 *  Behaviour
 * ─────────────────────────────────────────────────────────────────────
 *
 *   • Both IDs valid          → live chat loads automatically, the
 *                                SupportStatusPill flips to
 *                                "Live chat online".
 *   • Either ID missing/bad   → app does NOT break. Support cards
 *                                gracefully degrade to "Email & phone"
 *                                fallback. A single, clear console
 *                                warning is logged:
 *                                  [KAYA] Tawk widget not configured
 *
 * Property IDs are 24-character hexadecimal MongoDB ObjectIds.
 * Widget IDs are short alphanumeric strings (e.g. "1jrm1bddn").
 * NEVER use "default" as a Widget ID — it is not a real Tawk widget.
 */

// ─── FALLBACK CONFIG (edit these if you don't use .env) ──────────────
const FALLBACK_PROPERTY_ID = "6a385779d0dd3e1d406c816b";
const FALLBACK_WIDGET_ID = "1jrm1bddn";

// ─── Format validators ───────────────────────────────────────────────
const PROPERTY_ID_RE = /^[a-f0-9]{24}$/i;
const WIDGET_ID_RE = /^[a-z0-9]{6,}$/i;

// ─── Resolve the active IDs (env beats fallback) ─────────────────────
const ENV_PROPERTY_ID = (
  (import.meta.env.VITE_TAWK_PROPERTY_ID as string | undefined) ?? ""
).trim();
const ENV_WIDGET_ID = (
  (import.meta.env.VITE_TAWK_WIDGET_ID as string | undefined) ?? ""
).trim();

const TAWK_PROPERTY_ID = ENV_PROPERTY_ID || FALLBACK_PROPERTY_ID;
const TAWK_WIDGET_ID = ENV_WIDGET_ID || FALLBACK_WIDGET_ID;

const PROPERTY_ID_VALID =
  !!TAWK_PROPERTY_ID && PROPERTY_ID_RE.test(TAWK_PROPERTY_ID);
const WIDGET_ID_VALID =
  !!TAWK_WIDGET_ID && WIDGET_ID_RE.test(TAWK_WIDGET_ID);
const TAWK_CONFIGURED = PROPERTY_ID_VALID && WIDGET_ID_VALID;

const PROPERTY_SOURCE: "env" | "fallback" = ENV_PROPERTY_ID
  ? "env"
  : "fallback";
const WIDGET_SOURCE: "env" | "fallback" = ENV_WIDGET_ID ? "env" : "fallback";

// One-time configuration warning at module load. Keeps the console
// quiet when everything is wired up, but extremely clear when it isn't.
if (!TAWK_CONFIGURED && typeof window !== "undefined") {
  const reasons: string[] = [];
  if (!TAWK_PROPERTY_ID) {
    reasons.push("Property ID is empty");
  } else if (!PROPERTY_ID_VALID) {
    reasons.push(
      `Property ID "${TAWK_PROPERTY_ID}" is invalid (expected 24-char hex)`
    );
  }
  if (!TAWK_WIDGET_ID) {
    reasons.push("Widget ID is empty");
  } else if (!WIDGET_ID_VALID) {
    reasons.push(
      `Widget ID "${TAWK_WIDGET_ID}" is invalid (expected alphanumeric, min 6 chars)`
    );
  }
  console.warn(
    `[KAYA] Tawk widget not configured — ${reasons.join("; ")}. ` +
      `"Need help?" cards will fall back to email + phone support. ` +
      `Configure via .env (VITE_TAWK_PROPERTY_ID, VITE_TAWK_WIDGET_ID) ` +
      `or edit FALLBACK_PROPERTY_ID / FALLBACK_WIDGET_ID in ` +
      `src/lib/support.ts. Find both IDs in Tawk dashboard → ` +
      `Administration → Channels → Chat Widget.`
  );
}

// ─── Tawk runtime types ──────────────────────────────────────────────
interface TawkAPI {
  maximize?: () => void;
  minimize?: () => void;
  hideWidget?: () => void;
  showWidget?: () => void;
  setAttributes?: (
    attrs: Record<string, string>,
    cb?: (err?: unknown) => void
  ) => void;
  onLoad?: () => void;
  onStatusChange?: (status: string) => void;
  onChatMinimized?: () => void;
  onChatEnded?: () => void;
  onChatHidden?: () => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkAPI;
    Tawk_LoadStart?: Date;
  }
}

export type SupportStatus = "disabled" | "loading" | "ready" | "fallback";

let scriptInjected = false;
let widgetReady = false;
let scriptFailed = false;
let gaveUp = false;
let readyResolvers: Array<() => void> = [];

const statusListeners = new Set<(s: SupportStatus) => void>();

function currentStatus(): SupportStatus {
  // Not configured → identical UX to a failed load: email + phone fallback.
  if (!TAWK_CONFIGURED) return "fallback";
  if (widgetReady) return "ready";
  if (scriptFailed || gaveUp) return "fallback";
  return "loading";
}

function emit() {
  const s = currentStatus();
  statusListeners.forEach((l) => {
    try {
      l(s);
    } catch (err) {
      console.warn("[KAYA] support status listener threw:", err);
    }
  });
}

function flushResolvers() {
  const queued = readyResolvers;
  readyResolvers = [];
  queued.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.warn("[KAYA] Tawk ready resolver threw:", err);
    }
  });
}

function markReady(source: string) {
  if (widgetReady) return;
  widgetReady = true;
  scriptFailed = false;
  gaveUp = false;
  console.info(`[KAYA] Tawk.to live chat ready (${source})`);

  // KAYA opens chat ONLY via in-app "Need help?" buttons — keep the
  // default floating bubble hidden so it never blocks mobile navigation
  // or clutters the UI. Re-hide on minimize/end so the bubble vanishes
  // again the moment the user closes the chat panel.
  if (typeof window !== "undefined") {
    const api = window.Tawk_API;
    if (api) {
      try {
        api.hideWidget?.();
      } catch (err) {
        console.warn("[KAYA] Tawk hideWidget failed:", err);
      }
      api.onChatMinimized = () => {
        try {
          api.hideWidget?.();
        } catch {
          /* ignore */
        }
      };
      api.onChatEnded = () => {
        try {
          api.hideWidget?.();
        } catch {
          /* ignore */
        }
      };
    }
  }

  flushResolvers();
  emit();
}

function markFailed(reason: string) {
  if (widgetReady) return;
  scriptFailed = true;
  console.error(`[KAYA] Tawk.to load failure — ${reason}`);
  flushResolvers();
  emit();
}

function markGaveUp() {
  if (widgetReady || scriptFailed || gaveUp) return;
  gaveUp = true;
  console.warn(
    `[KAYA] Tawk.to widget never initialised within 15s for ` +
      `propertyId="${TAWK_PROPERTY_ID}" widgetId="${TAWK_WIDGET_ID}". ` +
      `Common causes: (1) Property ID doesn't exist on Tawk's CDN, ` +
      `(2) Widget ID doesn't match a real widget on this property, ` +
      `(3) ad-blocker or browser extension, (4) CSP blocking ` +
      `embed.tawk.to, (5) network firewall. Until resolved, "Need help?" ` +
      `cards will fall back to email / phone support.`
  );
  flushResolvers();
  emit();
}

/**
 * Lazily injects the Tawk.to embed script. Safe to call repeatedly — it
 * no-ops if the script is already loading or the integration isn't
 * configured. Sets up the `onLoad` callback plus a polling safety net
 * so widget readiness is detected even when `onLoad` is swallowed by
 * privacy extensions.
 */
export function loadTawk(): void {
  if (typeof window === "undefined") return;
  if (!TAWK_CONFIGURED) {
    // Already warned at import time — stay in fallback mode silently.
    return;
  }
  if (scriptInjected) return;

  scriptInjected = true;
  emit(); // flip listeners to "loading" the moment we start

  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();

  // Tawk fires onLoad once the imperative API attaches to window.Tawk_API.
  window.Tawk_API.onLoad = function () {
    markReady("onLoad");
  };

  const src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`;
  console.info(`[KAYA] Loading Tawk.to embed from ${src}`);

  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  script.charset = "UTF-8";
  script.setAttribute("crossorigin", "*");
  script.onerror = () => {
    markFailed(
      `script ${src} failed to load. Most likely an invalid Property/Widget ` +
        `ID combo (404), an ad-blocker, a network firewall, or a CSP rule ` +
        `blocking embed.tawk.to.`
    );
  };
  document.body.appendChild(script);

  // Safety net — some ad-blockers (uBlock, Brave Shields, Ghostery, etc.)
  // prevent onLoad from firing but still let Tawk_API attach to window.
  const started = Date.now();
  const interval = window.setInterval(() => {
    if (widgetReady || scriptFailed || gaveUp) {
      window.clearInterval(interval);
      return;
    }
    const api = window.Tawk_API;
    if (api && typeof api.maximize === "function") {
      window.clearInterval(interval);
      markReady("poll");
      return;
    }
    if (Date.now() - started > 15000) {
      window.clearInterval(interval);
      markGaveUp();
    }
  }, 250);
}

function waitForReady(timeoutMs: number): Promise<boolean> {
  if (widgetReady) return Promise.resolve(true);
  if (scriptFailed || gaveUp || !TAWK_CONFIGURED)
    return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(widgetReady);
    };
    readyResolvers.push(finish);
    window.setTimeout(finish, timeoutMs);
  });
}

export interface SupportContext {
  name?: string;
  email?: string;
  phone?: string;
  orderId?: string;
  orderStatus?: string;
  recipientName?: string;
}

function applyAttributes(api: TawkAPI, ctx?: SupportContext) {
  if (!ctx || typeof api.setAttributes !== "function") return;
  try {
    const attrs: Record<string, string> = {};
    if (ctx.name) attrs.name = ctx.name;
    if (ctx.email) attrs.email = ctx.email;
    if (ctx.phone) attrs.phone = ctx.phone;
    if (ctx.orderId) attrs.orderId = ctx.orderId;
    if (ctx.orderStatus) attrs.orderStatus = ctx.orderStatus;
    if (ctx.recipientName) attrs.recipientName = ctx.recipientName;
    if (Object.keys(attrs).length > 0) api.setAttributes(attrs);
  } catch (err) {
    console.warn("[KAYA] Tawk setAttributes failed:", err);
  }
}

function tryMaximize(ctx?: SupportContext): boolean {
  if (typeof window === "undefined") return false;
  const api = window.Tawk_API;
  if (!api || typeof api.maximize !== "function") return false;
  applyAttributes(api, ctx);
  try {
    // The bubble is hidden by default — reveal it just before opening
    // the chat panel so the user sees the embedded chat surface.
    api.showWidget?.();
    api.maximize();
    return true;
  } catch (err) {
    console.error("[KAYA] Tawk maximize failed:", err);
    return false;
  }
}

/**
 * Opens the Tawk.to chat panel and attaches the provided KAYA context as
 * visitor attributes so agents can assist faster. Resolves `true` once the
 * chat is visible, or `false` if the integration isn't configured or the
 * widget couldn't be reached after a 6s wait — callers can then fall back
 * to the email/phone toast.
 */
export async function openSupport(ctx?: SupportContext): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!TAWK_CONFIGURED) return false;

  // Make sure the script is loading — safe to call repeatedly.
  loadTawk();

  // Fast path: widget already initialised.
  if (tryMaximize(ctx)) return true;

  // Otherwise wait for onLoad / poll (up to 6s) and try again.
  const ready = await waitForReady(6000);
  if (!ready) return false;

  return tryMaximize(ctx);
}

export function isSupportConfigured(): boolean {
  return TAWK_CONFIGURED;
}

export function isSupportReady(): boolean {
  return widgetReady;
}

export function getSupportStatus(): SupportStatus {
  return currentStatus();
}

/**
 * Subscribe to live chat status changes. Fires immediately with the
 * current status so consumers don't need an extra useEffect to seed
 * their state.
 */
export function subscribeSupportStatus(
  cb: (status: SupportStatus) => void
): () => void {
  statusListeners.add(cb);
  cb(currentStatus());
  return () => {
    statusListeners.delete(cb);
  };
}

export interface SupportConfigSummary {
  configured: boolean;
  propertyId: string;
  widgetId: string;
  propertyIdValid: boolean;
  widgetIdValid: boolean;
  embedUrl: string;
  propertySource: "env" | "fallback";
  widgetSource: "env" | "fallback";
}

/**
 * Returns the current Tawk integration configuration. Surfaces the
 * exact Property/Widget IDs in use, where each came from (env or
 * fallback), and validation state — designed for an admin diagnostics
 * panel.
 */
export function getSupportConfigSummary(): SupportConfigSummary {
  return {
    configured: TAWK_CONFIGURED,
    propertyId: TAWK_PROPERTY_ID,
    widgetId: TAWK_WIDGET_ID,
    propertyIdValid: PROPERTY_ID_VALID,
    widgetIdValid: WIDGET_ID_VALID,
    embedUrl: `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`,
    propertySource: PROPERTY_SOURCE,
    widgetSource: WIDGET_SOURCE,
  };
}
