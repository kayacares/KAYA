/**
 * KAYA is a Ghana-first, GHS-only marketplace at launch. This
 * component used to let customers switch display currency; it now
 * renders a static badge showing "GH₵ GHS" so the TopBar layout
 * (which reserves a slot for it via the `right` prop across Home,
 * Cart and Profile) continues to render without exposing a disabled
 * control or a broken import.
 *
 * The name and file location are preserved so every existing wiring
 * keeps working. When multi-currency display is reintroduced
 * post-launch we can swap the internals back to a dropdown here
 * without touching consumers.
 *
 * Note: the currency symbol is written as a literal glyph (GH₵)
 * rather than a `\u20b5` escape because Unicode escape sequences
 * do not decode inside raw JSX children — they'd render verbatim.
 */
export default function CurrencySelector() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-white border border-charcoal-100 px-3 py-1.5 text-xs font-semibold text-charcoal-700"
      title="All KAYA prices are shown in Ghana Cedis (GH₵)."
      aria-label="Prices shown in Ghana Cedis"
    >
      <span className="text-mustard-600">GH₵</span>
      <span>GHS</span>
    </span>
  );
}
