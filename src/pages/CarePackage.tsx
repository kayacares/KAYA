import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Gift,
  Heart,
  MessageSquare,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatGHS } from "@/lib/currency";
import AddRecipientSheet from "@/components/features/AddRecipientSheet";
import CurrencySelector from "@/components/features/CurrencySelector";
import {
  CATEGORY_BY_ID,
  getPackageFulfillment,
  isCarePackageDeliverable,
  isCarePackageVisible,
} from "@/lib/carePackages";

/**
 * Customer-facing detail page for a single Care Package. Reads from
 * the admin-managed `carePackages` array (not the legacy hard-coded
 * BUNDLES) and surfaces every spec field: included products, estimated
 * delivery window, configurable delivery fee, gift options, and the
 * "Add Care Package to Cart" CTA.
 */
export default function CarePackage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    user,
    carePackages,
    products,
    recipients,
    shops,
    deliveryAreas,
    deliveryScheduleConfig,
    activeRecipientId,
    addToCart,
    setActiveRecipient,
    setCartBundleId,
    setCartMessage,
  } = useApp();
  const pkg = carePackages.find((p) => p.id === id);

  const [chosen, setChosen] = useState<string | null>(
    activeRecipientId ?? recipients[0]?.id ?? null
  );
  const [addOpen, setAddOpen] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [greetingCard, setGreetingCard] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");

  const items = useMemo(() => {
    if (!pkg) return [];
    return pkg.items.map((it) => {
      const product = products.find((p) => p.id === it.productId);
      return { ...it, product };
    });
  }, [pkg, products]);

  const fulfillment = useMemo(
    () => (pkg ? getPackageFulfillment(pkg, products) : null),
    [pkg, products]
  );

  const chosenRecipient = chosen
    ? recipients.find((r) => r.id === chosen)
    : null;
  const isDeliverable = pkg
    ? isCarePackageDeliverable(pkg, chosenRecipient, deliveryAreas)
    : true;
  const isVisible = pkg ? isCarePackageVisible(pkg) : false;

  if (!pkg) {
    return (
      <>
        <TopBar back title="Care package not found" />
        <main className="container-app px-4">
          <div className="card-base p-8 text-center mt-6">
            <p className="text-5xl mb-2">🎁</p>
            <p className="display text-xl font-semibold">
              That care package doesn&apos;t exist.
            </p>
            <p className="text-sm text-charcoal-400 mt-1">
              It may have been removed or scheduled for a different date.
            </p>
            <button onClick={() => navigate("/")} className="btn-primary mt-4">
              Back to home
            </button>
          </div>
        </main>
      </>
    );
  }

  const category = CATEGORY_BY_ID[pkg.category];
  const currency = user?.currency ?? "GHS";
  const availableItems = items.filter((it) => {
    if (!it.product) return false;
    const av =
      it.product.availability ??
      (it.product.active ? "active" : "inactive");
    return av === "active";
  });
  const unavailableItems = items.filter((it) => {
    if (!it.product) return true;
    const av =
      it.product.availability ??
      (it.product.active ? "active" : "inactive");
    return av !== "active";
  });

  const giftWrapFee =
    giftWrap && pkg.giftOptions?.giftWrapFeeGHS
      ? pkg.giftOptions.giftWrapFeeGHS
      : 0;
  const totalGHS = pkg.priceGHS + pkg.deliveryFeeGHS + giftWrapFee;

  // Surface the first active delivery window as the "estimated delivery"
  // copy. Customers can still pick a different window at checkout.
  const firstActiveWindow = deliveryScheduleConfig.windows.find(
    (w) => w.active
  );
  const deliveryWindowLabel = firstActiveWindow
    ? `${firstActiveWindow.label} (${firstActiveWindow.rangeLabel})`
    : "Pick your delivery window at checkout";

  const showGiftOptions =
    !!pkg.giftOptions &&
    (pkg.giftOptions.allowGiftWrap ||
      pkg.giftOptions.allowGreetingCard ||
      pkg.giftOptions.allowPersonalMessage);

  const send = () => {
    if (!isVisible) {
      toast.error("This care package is no longer available.");
      return;
    }
    if (availableItems.length === 0) {
      toast.error("All items in this care package are currently unavailable.");
      return;
    }
    // Guest path — allow adding to cart without a recipient. The
    // delivery area and recipient are captured after sign-in on the
    // checkout page so nothing about browsing requires an account.
    if (!user) {
      setCartBundleId(pkg.id);
      for (const it of availableItems) {
        if (it.product) addToCart(it.product.id, it.quantity);
      }
      const guestMessageParts: string[] = [];
      if (giftWrap) guestMessageParts.push("\uD83C\uDF81 Gift wrap requested");
      if (greetingCard.trim())
        guestMessageParts.push(
          `Greeting card to: ${greetingCard.trim()}`
        );
      if (personalMessage.trim())
        guestMessageParts.push(personalMessage.trim());
      if (guestMessageParts.length > 0)
        setCartMessage(guestMessageParts.join("\n"));
      toast.success(`${pkg.name} added`, {
        description: `${availableItems.length} item${
          availableItems.length === 1 ? "" : "s"
        } saved to your cart`,
      });
      navigate("/cart");
      return;
    }
    if (recipients.length === 0) {
      setAddOpen(true);
      return;
    }
    if (!chosen) {
      setAddOpen(true);
      return;
    }
    if (!isDeliverable) {
      toast.error(
        `This care package isn't available in ${
          chosenRecipient?.townArea ?? "your recipient's area"
        } yet.`
      );
      return;
    }
    setActiveRecipient(chosen);
    setCartBundleId(pkg.id);
    for (const it of availableItems) {
      if (it.product) addToCart(it.product.id, it.quantity);
    }
    // Stash gift options on the cart message so they're surfaced at
    // checkout / on the order detail page for ops.
    const messageParts: string[] = [];
    if (giftWrap) messageParts.push("🎁 Gift wrap requested");
    if (greetingCard.trim())
      messageParts.push(`Greeting card to: ${greetingCard.trim()}`);
    if (personalMessage.trim()) messageParts.push(personalMessage.trim());
    if (messageParts.length > 0) setCartMessage(messageParts.join("\n"));
    toast.success(`${pkg.name} added`, {
      description: `${availableItems.length} item${
        availableItems.length === 1 ? "" : "s"
      } on the way`,
    });
    navigate("/cart");
  };

  return (
    <>
      <TopBar
        back
        title={pkg.name}
        subtitle="Care package"
        right={<CurrencySelector />}
      />
      <main className="container-app px-4 pb-with-cta">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl mb-5 shadow-card">
          {pkg.coverImage ? (
            <>
              <img
                src={pkg.coverImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-b from-charcoal-900/30 via-charcoal-900/55 to-charcoal-900/85"
                aria-hidden
              />
            </>
          ) : (
            <div className={`absolute inset-0 ${pkg.accent}`} aria-hidden />
          )}
          <div
            className={`relative ${
              pkg.coverImage ? "text-cream-50" : ""
            } p-6 min-h-[260px] flex flex-col justify-end`}
          >
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span
                className={`chip ${
                  pkg.coverImage
                    ? "bg-white/20 backdrop-blur text-cream-50"
                    : "bg-white/30 text-charcoal-900"
                } text-[10px] uppercase tracking-wider font-bold`}
              >
                <span>{category.emoji}</span> {category.label}
              </span>
              {pkg.featured && (
                <span className="chip bg-mustard-400 text-charcoal-900 text-[10px] uppercase tracking-wider font-bold">
                  <Sparkles size={10} /> Featured
                </span>
              )}
              {pkg.badge && (
                <span className="chip bg-white/95 backdrop-blur text-charcoal-900 text-[10px] uppercase tracking-wider font-bold">
                  {pkg.badge}
                </span>
              )}
            </div>
            <div className="text-5xl mb-2 drop-shadow">{pkg.emoji}</div>
            <h1 className="display text-3xl font-semibold leading-tight text-balance">
              {pkg.name}
            </h1>
            <p className="text-sm mt-1.5 opacity-95 max-w-md">
              {pkg.shortDescription}
            </p>
          </div>
        </section>

        {/* Recipient picker — always visible so the shopping
            experience keeps its familiar structure. Guests hit the
            "Add a recipient first" prompt which routes them to
            sign in (and returns them here after auth). */}
        <section className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
            Send this to
          </h3>
          {recipients.length === 0 ? (
            <button
              onClick={() =>
                user
                  ? setAddOpen(true)
                  : navigate(
                      `/login?next=${encodeURIComponent(
                        `/care-package/${pkg.id}`
                      )}`
                    )
              }
              className="card-base w-full p-4 flex items-center gap-3 hover:border-charcoal-400 transition text-left"
            >
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-cream-100 text-mustard-600 shrink-0">
                <Plus size={18} />
              </span>
              <div>
                <p className="font-semibold text-sm">Add a recipient first</p>
                <p className="text-xs text-charcoal-400">
                  Save their address once. Then send care anytime.
                </p>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {recipients.map((r) => {
                const active = chosen === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setChosen(r.id)}
                    className={`relative flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                        : "bg-white text-charcoal-900 border-charcoal-100 hover:border-charcoal-400"
                    }`}
                  >
                    <span className="text-xl shrink-0">{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">
                        {r.fullName}
                      </p>
                      <p
                        className={`text-[10px] truncate ${
                          active ? "text-cream-100/70" : "text-charcoal-400"
                        }`}
                      >
                        {r.relationship}
                      </p>
                    </div>
                    {active && (
                      <Check size={14} className="shrink-0 text-mustard-400" />
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2.5 rounded-2xl border border-dashed border-charcoal-400/40 hover:border-charcoal-400 px-3 py-2.5 text-left bg-cream-100/60"
              >
                <span className="grid place-items-center w-8 h-8 rounded-xl bg-white text-mustard-600 shrink-0">
                  <Plus size={16} />
                </span>
                <p className="text-xs font-semibold">Add new</p>
              </button>
            </div>
          )}
        </section>

        {/* Delivery details */}
        <section className="card-base p-4 mb-5">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0">
              <CalendarClock size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
                Estimated delivery
              </p>
              <p className="font-semibold text-sm mt-0.5">
                {deliveryWindowLabel}
              </p>
              <p className="text-xs text-charcoal-400 mt-0.5">
                Pick your exact day & window at checkout. Delivery fee:{" "}
                {formatGHS(pkg.deliveryFeeGHS)}.
              </p>
            </div>
          </div>
          {chosenRecipient && !isDeliverable && (
            <div className="mt-3 rounded-2xl bg-clay-400/10 border border-clay-400/30 px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle
                size={12}
                className="shrink-0 mt-0.5 text-clay-600"
              />
              <span className="text-xs text-clay-600">
                Not yet available in{" "}
                {chosenRecipient.townArea ?? chosenRecipient.city}. Pick a
                different recipient or shop standalone items instead.
              </span>
            </div>
          )}
        </section>

        {/* Items */}
        <section className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
            What&apos;s inside
          </h3>
          {fulfillment?.needsSubstitution && !fulfillment.unfulfillable && (
            <div className="rounded-2xl bg-mustard-100 border border-mustard-400/40 text-charcoal-700 text-xs px-4 py-2.5 mb-2 flex items-start gap-2">
              <AlertTriangle
                size={12}
                className="shrink-0 mt-0.5 text-mustard-700"
              />
              <span>
                {unavailableItems.length}{" "}
                {unavailableItems.length === 1 ? "item is" : "items are"}{" "}
                temporarily unavailable. We&apos;ll honour your substitution
                preference at checkout.
              </span>
            </div>
          )}
          <div className="card-base divide-y divide-charcoal-100">
            {items.map((item) => {
              if (!item.product) {
                return (
                  <div
                    key={item.productId}
                    className="flex items-center gap-3 p-3 opacity-60"
                  >
                    <span className="grid place-items-center w-14 h-14 rounded-xl bg-clay-400/15 text-clay-600">
                      <Package size={20} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-clay-600">
                        Product removed
                      </p>
                      <p className="text-[10px] text-charcoal-400 truncate">
                        {item.productId}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center justify-center h-7 px-3 rounded-full bg-cream-100 text-charcoal-700 text-[11px] font-bold tabular-nums">
                      Qty: {item.quantity}
                    </span>
                  </div>
                );
              }
              const av =
                item.product.availability ??
                (item.product.active ? "active" : "inactive");
              const unavailable = av !== "active";
              const shop = shops.find((s) => s.id === item.product!.shopId);
              return (
                <div
                  key={item.productId}
                  className={`flex items-center gap-3 p-3 ${
                    unavailable ? "opacity-60" : ""
                  }`}
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    loading="lazy"
                    className={`w-14 h-14 rounded-xl object-cover bg-cream-100 ${
                      unavailable ? "grayscale" : ""
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {item.product.name}
                    </p>
                    <p className="text-[10px] text-charcoal-400 truncate">
                      {shop?.emoji} {shop?.name} · {item.product.unit}
                    </p>
                    {unavailable && (
                      <p className="text-[10px] uppercase tracking-wider text-mustard-700 font-bold mt-0.5">
                        Temporarily unavailable
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center justify-center h-7 px-3 rounded-full bg-cream-100 text-charcoal-700 text-[11px] font-bold tabular-nums">
                    Qty: {item.quantity}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Gift options */}
        {showGiftOptions && (
          <section className="mb-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
              Make it personal
            </h3>
            <div className="card-base p-4 space-y-3">
              {pkg.giftOptions?.allowGiftWrap && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giftWrap}
                    onChange={(e) => setGiftWrap(e.target.checked)}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <Gift size={14} className="text-mustard-600" /> Add gift
                      wrapping
                    </p>
                    <p className="text-xs text-charcoal-400 mt-0.5">
                      Wrapped in KAYA&apos;s signature paper{" "}
                      {pkg.giftOptions.giftWrapFeeGHS
                        ? `· +${formatGHS(
                            pkg.giftOptions.giftWrapFeeGHS
                          )}`
                        : "· free"}
                    </p>
                  </div>
                </label>
              )}
              {pkg.giftOptions?.allowGreetingCard && (
                <label className="block">
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    <Heart size={14} className="text-clay-600" /> Greeting card
                    recipient
                  </span>
                  <input
                    value={greetingCard}
                    onChange={(e) => setGreetingCard(e.target.value)}
                    placeholder="e.g. To Mama Akua"
                    maxLength={40}
                    className="input-base mt-1.5"
                  />
                </label>
              )}
              {pkg.giftOptions?.allowPersonalMessage && (
                <label className="block">
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-sage-700" />{" "}
                    Personal message
                  </span>
                  <textarea
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                    placeholder="A short note to include with your care package..."
                    maxLength={240}
                    className="input-base mt-1.5 min-h-[80px]"
                  />
                  <span className="text-[10px] text-charcoal-400">
                    {personalMessage.length}/240
                  </span>
                </label>
              )}
            </div>
          </section>
        )}

        {/* Pricing breakdown */}
        <section className="card-base p-4 mb-5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-2.5">
            Pricing
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-charcoal-700">Care package</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(pkg.priceGHS, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-charcoal-700">Delivery fee</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(pkg.deliveryFeeGHS, currency)}
              </span>
            </div>
            {giftWrapFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-charcoal-700">Gift wrapping</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(giftWrapFee, currency)}
                </span>
              </div>
            )}
            <div className="border-t border-charcoal-100 mt-2 pt-2 flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="display text-xl font-bold tabular-nums">
                {formatCurrency(totalGHS, currency)}
              </span>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed above-bottom-nav inset-x-0 z-30 px-4">
        <div className="container-app">
          <button
            onClick={send}
            disabled={fulfillment?.unfulfillable}
            className="card-base w-full bg-charcoal-800 text-cream-50 border-charcoal-700 p-4 flex items-center justify-between shadow-hi hover:bg-charcoal-700 disabled:bg-charcoal-100 disabled:text-charcoal-400 transition"
          >
            <div className="text-left">
              <p className="text-[11px] uppercase tracking-wider text-mustard-400 font-semibold">
                {fulfillment?.unfulfillable
                  ? "Currently unavailable"
                  : "Package total"}
              </p>
              <p className="display text-2xl font-bold">
                {formatCurrency(totalGHS, currency)}
              </p>
            </div>
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingBag size={18} /> Add Care Package to Cart
            </span>
          </button>
        </div>
      </div>
      <AddRecipientSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
