import { useMemo, useState } from "react";
import { AlertTriangle, Replace, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import type { Order, Product } from "@/types";
import { formatGHS } from "@/lib/currency";

export interface SubstitutionModalProps {
  order: Order;
  products: Product[];
  highValueThreshold: number;
  onClose: () => void;
  onSubmit: (data: {
    originalProductId: string;
    action: "substituted" | "removed" | "approval_pending";
    replacementProductId?: string;
    replacementQuantity?: number;
    reason: string;
  }) => Promise<void> | void;
}

const PREF_LABEL: Record<string, string> = {
  allow: "Allow similar substitutions",
  contact_first: "Contact me before substituting",
  remove: "Remove unavailable items",
};

/**
 * Ops modal for handling an unavailable item on an order. Honours the
 * customer's stored substitution preference and forces customer approval
 * for high-value items (>= configured threshold).
 */
export default function SubstitutionModal({
  order,
  products,
  highValueThreshold,
  onClose,
  onSubmit,
}: SubstitutionModalProps) {
  const [originalProductId, setOriginalProductId] = useState<string>(
    order.items[0]?.productId ?? ""
  );
  const [action, setAction] = useState<
    "substituted" | "removed" | "approval_pending"
  >(order.substitutionPreference === "remove" ? "removed" : "substituted");
  const [replacementProductId, setReplacementProductId] = useState<string>("");
  const [replacementQuantity, setReplacementQuantity] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const originalItem = order.items.find(
    (i) => i.productId === originalProductId
  );
  const originalProduct = products.find((p) => p.id === originalProductId);
  const isHighValue = originalProduct
    ? originalProduct.sellingPrice >= highValueThreshold
    : false;
  const preferContact = order.substitutionPreference === "contact_first";
  const forcedApproval = isHighValue || preferContact;
  const effectiveAction =
    forcedApproval && action === "substituted" ? "approval_pending" : action;

  const replacementCandidates = useMemo(() => {
    if (!originalProduct) return [];
    return products.filter(
      (p) =>
        p.id !== originalProductId &&
        p.shopId === originalProduct.shopId &&
        (p.availability ?? (p.active ? "active" : "inactive")) === "active"
    );
  }, [products, originalProduct, originalProductId]);

  /**
   * Auto-pick the closest replacement from the same shop, preferring
   * candidates that share the original product's category, then ranking
   * by absolute price distance from the original. Pre-fills the
   * replacement select + qty and flips the action to substitute.
   */
  const smartSuggest = () => {
    if (!originalProduct || replacementCandidates.length === 0) return;
    const sameCategory = replacementCandidates.filter(
      (p) => p.category === originalProduct.category
    );
    const pool =
      sameCategory.length > 0 ? sameCategory : replacementCandidates;
    const ranked = [...pool].sort(
      (a, b) =>
        Math.abs(a.sellingPrice - originalProduct.sellingPrice) -
        Math.abs(b.sellingPrice - originalProduct.sellingPrice)
    );
    const best = ranked[0];
    if (!best) return;
    setReplacementProductId(best.id);
    setReplacementQuantity(originalItem?.quantity ?? 1);
    if (action !== "substituted") setAction("substituted");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!originalProductId || !originalItem) {
      setError("Pick an item to handle.");
      return;
    }
    if (!reason.trim()) {
      setError("Please add a short reason for the audit log.");
      return;
    }
    if (effectiveAction === "substituted") {
      if (!replacementProductId) {
        setError("Pick a replacement product.");
        return;
      }
      if (replacementQuantity <= 0) {
        setError("Replacement quantity must be at least 1.");
        return;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit({
        originalProductId,
        action: effectiveAction,
        replacementProductId:
          effectiveAction === "removed"
            ? undefined
            : replacementProductId || undefined,
        replacementQuantity:
          effectiveAction === "removed" || !replacementProductId
            ? undefined
            : replacementQuantity,
        reason: reason.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel =
    effectiveAction === "removed"
      ? "Remove item from order"
      : effectiveAction === "approval_pending"
      ? "Flag for customer approval"
      : "Record substitution";
  const SubmitIcon =
    effectiveAction === "removed"
      ? Trash2
      : effectiveAction === "approval_pending"
      ? AlertTriangle
      : Replace;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-charcoal-900/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="substitution-title"
        className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0">
            <Replace size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700">
              Handle availability
            </p>
            <h3
              id="substitution-title"
              className="display text-xl font-semibold leading-tight"
            >
              Substitution · #{order.id.slice(-6).toUpperCase()}
            </h3>
            <p className="text-xs text-charcoal-400 mt-1 leading-snug">
              Customer prefers:{" "}
              <span className="font-semibold text-charcoal-700">
                {PREF_LABEL[order.substitutionPreference ?? "allow"]}
              </span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Unavailable item
            </p>
            <select
              value={originalProductId}
              onChange={(e) => {
                setOriginalProductId(e.target.value);
                setReplacementProductId("");
              }}
              className="input-base text-sm"
            >
              {order.items.map((it) => (
                <option key={it.productId} value={it.productId}>
                  {it.name} · ×{it.quantity} · {formatGHS(it.priceGHS)}
                </option>
              ))}
            </select>
          </div>

          {isHighValue && (
            <div className="rounded-2xl bg-clay-400/10 border border-clay-400/40 text-clay-600 text-xs px-3 py-2.5 flex items-start gap-2">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <p className="leading-snug">
                <span className="font-semibold">High-value item.</span>{" "}
                {formatGHS(originalProduct?.sellingPrice ?? 0)} ≥ threshold{" "}
                {formatGHS(highValueThreshold)}. Customer approval is required —
                we won't auto-substitute.
              </p>
            </div>
          )}
          {!isHighValue && preferContact && (
            <div className="rounded-2xl bg-mustard-100 border border-mustard-400/40 text-charcoal-700 text-xs px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle
                size={14}
                className="shrink-0 mt-0.5 text-mustard-700"
              />
              <p className="leading-snug">
                This customer chose{" "}
                <span className="font-semibold">contact first</span>. Any
                replacement will be sent for their approval before the order
                line changes.
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Action
            </p>
            <div className="space-y-2">
              <ActionRadio
                label="Substitute with another product"
                description={
                  forcedApproval
                    ? "Disabled — customer approval needed first."
                    : "Updates the order line and notifies the customer."
                }
                disabled={forcedApproval}
                checked={action === "substituted" && !forcedApproval}
                onChange={() => setAction("substituted")}
              />
              <ActionRadio
                label="Remove the item"
                description="Drops the line, recalculates totals, notifies the customer."
                checked={action === "removed"}
                onChange={() => setAction("removed")}
              />
              <ActionRadio
                label="Request customer approval"
                description="Flags as Needs Attention. Customer reviews proposal in their order."
                checked={
                  action === "approval_pending" ||
                  (forcedApproval && action === "substituted")
                }
                onChange={() => setAction("approval_pending")}
              />
            </div>
          </div>

          {(effectiveAction === "substituted" ||
            effectiveAction === "approval_pending") && (
            <div className="space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
                  {effectiveAction === "approval_pending"
                    ? "Suggested replacement (optional)"
                    : "Replacement product"}
                </p>
                <select
                  value={replacementProductId}
                  onChange={(e) => setReplacementProductId(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">
                    {effectiveAction === "approval_pending"
                      ? "No suggestion — ask customer to pick"
                      : "Choose replacement…"}
                  </option>
                  {replacementCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatGHS(p.sellingPrice)}
                    </option>
                  ))}
                </select>
                {replacementCandidates.length === 0 ? (
                  <p className="text-[11px] text-clay-600 mt-1">
                    No replacements available in this shop. Use "Remove" or
                    request approval.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={smartSuggest}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mustard-100 hover:bg-mustard-400 text-charcoal-900 px-3 py-1.5 text-[11px] font-bold transition"
                  >
                    <Sparkles size={11} /> Smart suggest closest match
                  </button>
                )}
              </div>
              {effectiveAction === "substituted" && replacementProductId && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
                    Replacement quantity
                  </p>
                  <input
                    type="number"
                    min={1}
                    value={replacementQuantity}
                    onChange={(e) =>
                      setReplacementQuantity(
                        Math.max(1, Number(e.target.value))
                      )
                    }
                    className="input-base text-sm"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Reason · required
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-base min-h-[72px] resize-none"
              placeholder="e.g. Vendor sold out of Milo 400g — only 500g in stock"
              maxLength={300}
              rows={3}
            />
            <p className="text-[10px] text-charcoal-400 mt-1">
              Logged in audit + included in the customer notification.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-xs px-4 py-2"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-charcoal-900 hover:bg-charcoal-700 text-cream-50 text-sm font-bold py-3 transition disabled:opacity-60"
            >
              <SubmitIcon size={14} />
              {submitting ? "Saving…" : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-outline disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActionRadio({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 transition ${
        checked
          ? "border-charcoal-800 bg-cream-100"
          : "border-charcoal-100 bg-white hover:border-charcoal-400"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-1 w-4 h-4 accent-charcoal-800"
      />
      <span className="flex-1">
        <span className="text-sm font-semibold block">{label}</span>
        <span className="text-[11px] text-charcoal-400 leading-snug">
          {description}
        </span>
      </span>
    </label>
  );
}
