import type { Currency } from "@/types";

/**
 * KAYA is a Ghana-first, GHS-only marketplace at launch.
 * ---------------------------------------------------------------
 * Every product price, care-package price, delivery fee, service
 * fee, cart total and checkout total is stored *and* displayed in
 * Ghana Cedis (GH₵). This eliminates FX risk and gives customers,
 * ops and finance a single authoritative number to reason about.
 *
 * The customer's home country is still captured on the profile for
 * communication, analytics and delivery-notification tailoring —
 * it no longer influences pricing or the display currency.
 *
 * The `Currency` type and the CURRENCY_SYMBOL / RATES_TO_GHS maps
 * are retained solely for order-history back-compat: pre-launch
 * orders may still carry a non-GHS `senderCurrency` on their record
 * and the refund flow needs to talk to Stripe in the currency the
 * original charge was made in. Nothing in the current customer app
 * uses them for display.
 */

// Retained for legacy refund flows only. Do not use for display.
export const RATES_TO_GHS: Record<Currency, number> = {
  GHS: 1,
  USD: 12.4,
  GBP: 15.6,
  CAD: 9.1,
  EUR: 13.3,
  AED: 3.38,
};

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  GHS: "GH\u20b5",
  USD: "$",
  GBP: "\u00a3",
  CAD: "C$",
  EUR: "\u20ac",
  AED: "\u062f.\u0625",
};

/**
 * Convert a GHS amount to a foreign currency at the mock rate above.
 * Retained for the refund flow so Stripe can be refunded in the
 * currency the original charge was made in. Not used for display
 * anywhere in the customer app.
 */
export function fromGHS(amountGHS: number, target: Currency): number {
  const rate = RATES_TO_GHS[target] || 1;
  return amountGHS / rate;
}

/**
 * Canonical GHS formatter. Every price on every screen ultimately
 * flows through this function.
 */
export function formatGHS(n: number) {
  return `GH\u20b5${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * KAYA is Ghana-first — every price surfaces in GHS regardless of
 * where the customer lives. The second argument is preserved for
 * back-compat with existing call sites but intentionally ignored so
 * no screen ever renders a mixed-currency price.
 *
 * When multi-currency display is reintroduced (post-launch, once we
 * settle FX and reconciliation), swap this implementation back to a
 * per-currency formatter — every call site already passes the
 * customer's preferred currency, so no downstream changes needed.
 */
export function formatCurrency(amountGHS: number, _currency?: Currency) {
  return formatGHS(amountGHS);
}

export const SUPPORTED_FOREIGN: Currency[] = [
  "USD",
  "GBP",
  "CAD",
  "EUR",
  "AED",
];
