import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency } from "@/lib/currency";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock4,
  Heart,
  MessageCircle,
  Plus,
  Replace,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import AddRecipientSheet from "@/components/features/AddRecipientSheet";
import {
  formatScheduledDate,
  getAvailableDates,
  getWindowAvailability,
} from "@/lib/deliverySchedule";
import type {
  DeliverySchedule,
  RecipientAvailability,
  SubstitutionPreference,
} from "@/types";

/**
 * Pre-launch Checkout — KAYA isn't taking paid orders yet. Instead of
 * Stripe redirect we confirm the user's basket is "saved for launch
 * day", make sure their email is on the waitlist, and surface the
 * referral code so they can boost their queue position.
 */
export default function Checkout() {
  const {
    cart,
    products,
    recipients,
    activeRecipientId,
    user,
    shops,
    orders,
    deliveryScheduleConfig,
    isOnWaitlist,
    addWaitlistEntry,
    setUserSubstitutionPreference,
  } = useApp();
  const navigate = useNavigate();
  const recipient =
    recipients.find((r) => r.id === activeRecipientId) || recipients[0];

  const lines = useMemo(
    () =>
      cart
        .map((l) => {
          const p = products.find((x) => x.id === l.productId);
          return p ? { ...l, product: p } : null;
        })
        .filter(Boolean) as {
        productId: string;
        quantity: number;
        product: { name: string; sellingPrice: number; shopId: string };
      }[],
    [cart, products]
  );

  const subtotalGHS = lines.reduce(
    (s, l) => s + l.product.sellingPrice * l.quantity,
    0
  );
  const currency = user?.currency ?? "GHS";
  const totalItems = lines.reduce((a, b) => a + b.quantity, 0);

  const [substitutionPref, setSubstitutionPref] =
    useState<SubstitutionPreference>(
      user?.substitutionPreference ?? "allow"
    );

  // ── Delivery scheduling state ───────────────────────────
  const dateOptions = useMemo(
    () => getAvailableDates(deliveryScheduleConfig, orders),
    [deliveryScheduleConfig, orders]
  );
  const firstAvailableDate =
    dateOptions.find((d) => d.available)?.iso ?? "";
  const [selectedDateISO, setSelectedDateISO] = useState<string>(
    firstAvailableDate
  );
  const [showCustomDate, setShowCustomDate] = useState(false);

  useEffect(() => {
    if (!selectedDateISO && firstAvailableDate) {
      setSelectedDateISO(firstAvailableDate);
    }
  }, [selectedDateISO, firstAvailableDate]);

  const windowsForDate = useMemo(
    () =>
      deliveryScheduleConfig.windows.map((w) => ({
        window: w,
        availability: selectedDateISO
          ? getWindowAvailability(
              selectedDateISO,
              w,
              orders,
              deliveryScheduleConfig
            )
          : {
              available: false,
              capacity: w.capacity,
              used: 0,
              remaining: 0,
              reason: "Pick a date",
            },
      })),
    [selectedDateISO, deliveryScheduleConfig, orders]
  );
  const firstAvailableWindowId =
    windowsForDate.find((w) => w.availability.available)?.window.id ?? "";

  const [selectedWindowId, setSelectedWindowId] = useState<string>("");

  // Auto-pick the first available window on date change, and reset
  // the selection if the customer's previous pick has filled up.
  useEffect(() => {
    if (!selectedWindowId) {
      if (firstAvailableWindowId) setSelectedWindowId(firstAvailableWindowId);
      return;
    }
    const current = windowsForDate.find(
      (w) => w.window.id === selectedWindowId
    );
    if (!current || !current.availability.available) {
      setSelectedWindowId(firstAvailableWindowId);
    }
  }, [windowsForDate, selectedWindowId, firstAvailableWindowId]);

  const [recipientAvail, setRecipientAvail] =
    useState<RecipientAvailability>("available");
  const [specialInstructions, setSpecialInstructions] = useState<string>("");

  const [confirmed, setConfirmed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  if (lines.length === 0 || !user) {
    return (
      <>
        <TopBar back title="Your basket" />
        <main className="container-app px-4">
          <div className="card-base p-10 text-center mt-10">
            <div className="text-5xl mb-3">🧺</div>
            <h2 className="display text-2xl font-semibold">
              Nothing saved yet
            </h2>
            <p className="text-sm text-charcoal-400 mt-1">
              Browse shops and bundles to save items for launch day.
            </p>
            <Link to="/" className="btn-primary mt-5 inline-flex">
              Explore shops
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!recipient) {
    return (
      <>
        <TopBar back title="Almost there" />
        <main className="container-app px-4">
          <div className="card-base p-10 text-center mt-10">
            <div className="text-5xl mb-3">💛</div>
            <h2 className="display text-2xl font-semibold">
              Add a recipient
            </h2>
            <p className="text-sm text-charcoal-400 mt-1 max-w-xs mx-auto">
              Save someone's address so we know where to send your basket
              when KAYA launches.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="btn-primary mt-5 inline-flex"
            >
              <Plus size={16} /> Add a recipient
            </button>
            <div className="mt-3">
              <Link
                to="/cart"
                className="text-xs font-semibold text-charcoal-400 hover:text-charcoal-900"
              >
                Back to cart
              </Link>
            </div>
          </div>
        </main>
        <AddRecipientSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
        />
      </>
    );
  }

  const selectedWindow = windowsForDate.find(
    (w) => w.window.id === selectedWindowId
  )?.window;
  const scheduleSummary: DeliverySchedule | null =
    selectedDateISO && selectedWindow
      ? {
          date: selectedDateISO,
          windowId: selectedWindow.id,
          windowLabel: selectedWindow.label,
          windowRangeLabel: selectedWindow.rangeLabel,
          recipientAvailable: recipientAvail,
          specialInstructions: specialInstructions.trim() || undefined,
        }
      : null;
  const noWindowsAvailable =
    !!selectedDateISO &&
    !windowsForDate.some((w) => w.availability.available);

  const handleConfirm = () => {
    if (!isOnWaitlist) {
      addWaitlistEntry({
        name: user.name,
        email: user.email,
        phone: user.phone,
        source: "checkout",
        referredByCode: user.referredByCode,
      });
    }
    setUserSubstitutionPreference(substitutionPref);
    setConfirmed(true);
    const scheduleNote = scheduleSummary
      ? ` Preferred window: ${formatScheduledDate(scheduleSummary.date)} \u00b7 ${scheduleSummary.windowLabel}.`
      : "";
    toast.success("You're on the launch list", {
      description: `We'll email you the moment KAYA opens for orders.${scheduleNote}`,
      duration: 4500,
    });
  };

  return (
    <>
      <TopBar back title="Almost there" />
      <main className="container-app px-4 pb-10">
        {/* Pre-launch hero */}
        <section className="card-base p-6 mb-4 bg-charcoal-800 text-cream-50 border-charcoal-700 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-mustard-400/20 blur-3xl"
          />
          <div className="relative">
            <div className="chip bg-mustard-400 text-charcoal-900 mb-3">
              <Sparkles size={12} /> Launching soon
            </div>
            <h1 className="display text-3xl sm:text-4xl font-semibold leading-tight">
              KAYA is preparing for launch in Accra & Tema
            </h1>
            <p className="mt-3 text-sm sm:text-base text-cream-100/85 leading-relaxed max-w-prose">
              Your basket is safely saved. Join the waitlist and be among the
              first families to send care through KAYA. We'll email you the
              moment we open for orders so {recipient.fullName.split(" ")[0]}{" "}
              can get their first care package right away.
            </p>
          </div>
        </section>

        {/* Saved basket recap */}
        <section className="card-base p-4 mb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-400">
                Saved for {recipient.fullName.split(" ")[0]}
              </p>
              <h3 className="display text-lg font-semibold leading-tight mt-0.5">
                {totalItems} {totalItems === 1 ? "item" : "items"} ready to
                send
              </h3>
            </div>
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-cream-100 text-2xl shrink-0">
              {recipient.emoji}
            </span>
          </div>
          <div className="divide-y divide-charcoal-100">
            {lines.slice(0, 4).map((l) => {
              const shop = shops.find((s) => s.id === l.product.shopId);
              return (
                <div
                  key={l.productId}
                  className="py-2 flex items-center justify-between text-sm gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {l.product.name}{" "}
                      <span className="text-charcoal-400 font-normal">
                        × {l.quantity}
                      </span>
                    </p>
                    <p className="text-[11px] text-charcoal-400">
                      {shop?.name}
                    </p>
                  </div>
                  <span className="font-semibold whitespace-nowrap text-charcoal-700">
                    {formatCurrency(
                      l.product.sellingPrice * l.quantity,
                      currency
                    )}
                  </span>
                </div>
              );
            })}
            {lines.length > 4 && (
              <p className="py-2 text-[11px] text-charcoal-400 text-center">
                + {lines.length - 4} more saved
              </p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-charcoal-100 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-400">
              Basket value
            </span>
            <span className="display font-bold text-lg">
              {formatCurrency(subtotalGHS, currency)}
            </span>
          </div>
        </section>

        {/* Substitution preference */}
        <section className="card-base p-5 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-cream-100 text-charcoal-700 shrink-0">
              <Replace size={16} />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-400">
                If an item becomes unavailable
              </p>
              <h3 className="display font-semibold text-lg leading-tight">
                What would you like us to do?
              </h3>
            </div>
          </div>
          <div className="space-y-2">
            <PrefRadio
              label="Allow similar substitutions"
              description="We'll swap with the closest equivalent from the same category and let you know."
              checked={substitutionPref === "allow"}
              onChange={() => setSubstitutionPref("allow")}
              recommended
            />
            <PrefRadio
              label="Contact me before making substitutions"
              description="We'll pause that line and reach out before changing anything."
              checked={substitutionPref === "contact_first"}
              onChange={() => setSubstitutionPref("contact_first")}
            />
            <PrefRadio
              label="Remove unavailable items and continue"
              description="We'll drop the line, refund the difference and ship the rest."
              checked={substitutionPref === "remove"}
              onChange={() => setSubstitutionPref("remove")}
            />
          </div>
          <p className="text-[10px] text-charcoal-400 mt-3 leading-snug">
            We always require your approval before substituting high-value
            appliances, regardless of this preference.
          </p>
        </section>

        {/* Delivery scheduling */}
        <section className="card-base p-5 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-sage-100 text-sage-700 shrink-0">
              <CalendarDays size={16} />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-400">
                Schedule delivery
              </p>
              <h3 className="display font-semibold text-lg leading-tight">
                When should we deliver?
              </h3>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-2">
              Delivery date
            </p>
            <div className="grid grid-cols-3 gap-2">
              <DateChip
                label="Today"
                disabled={!dateOptions[0]?.available}
                active={
                  !showCustomDate &&
                  selectedDateISO === dateOptions[0]?.iso
                }
                onClick={() => {
                  if (!dateOptions[0]?.available) return;
                  setSelectedDateISO(dateOptions[0].iso);
                  setShowCustomDate(false);
                }}
              />
              <DateChip
                label="Tomorrow"
                disabled={!dateOptions[1]?.available}
                active={
                  !showCustomDate &&
                  selectedDateISO === dateOptions[1]?.iso
                }
                onClick={() => {
                  if (!dateOptions[1]?.available) return;
                  setSelectedDateISO(dateOptions[1].iso);
                  setShowCustomDate(false);
                }}
              />
              <DateChip
                label="Pick a date"
                active={showCustomDate}
                onClick={() => setShowCustomDate(true)}
              />
            </div>
            {showCustomDate && (
              <input
                type="date"
                value={selectedDateISO}
                min={dateOptions[0]?.iso ?? ""}
                max={dateOptions[dateOptions.length - 1]?.iso ?? ""}
                onChange={(e) => setSelectedDateISO(e.target.value)}
                className="input-base mt-2 text-sm"
              />
            )}
            {selectedDateISO && (
              <p className="text-[11px] text-charcoal-400 mt-2">
                Delivery slot for{" "}
                <span className="font-semibold text-charcoal-700">
                  {formatScheduledDate(selectedDateISO)}
                </span>
              </p>
            )}
          </div>

          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-2">
              Delivery window
            </p>
            <div className="space-y-2">
              {windowsForDate.map(({ window: w, availability }) => {
                const isSelected = selectedWindowId === w.id;
                const isDisabled = !availability.available;
                return (
                  <button
                    type="button"
                    key={w.id}
                    disabled={isDisabled}
                    onClick={() => setSelectedWindowId(w.id)}
                    className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition flex items-center gap-3 ${
                      isSelected && !isDisabled
                        ? "border-charcoal-800 bg-cream-100"
                        : "border-charcoal-100 bg-white hover:border-charcoal-400"
                    } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${
                        isDisabled
                          ? "bg-charcoal-100 text-charcoal-400"
                          : isSelected
                          ? "bg-charcoal-800 text-mustard-400"
                          : "bg-mustard-100 text-mustard-700"
                      }`}
                    >
                      <Clock4 size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{w.label}</p>
                      <p className="text-xs text-charcoal-400 truncate">
                        {w.rangeLabel}
                      </p>
                      {isDisabled && availability.reason && (
                        <p className="text-[10px] text-clay-600 font-semibold mt-0.5">
                          {availability.reason}
                        </p>
                      )}
                    </div>
                    {!isDisabled &&
                      availability.remaining < availability.capacity && (
                        <span className="chip bg-mustard-100 text-mustard-700 text-[10px] shrink-0">
                          {availability.remaining} left
                        </span>
                      )}
                  </button>
                );
              })}
            </div>
            {noWindowsAvailable && (
              <p className="text-[11px] text-clay-600 mt-2 leading-snug">
                No windows available for that day — try another date.
              </p>
            )}
          </div>

          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-2">
              Will someone be available to receive this order?
            </p>
            <div className="space-y-2">
              <AvailabilityRadio
                label="Yes"
                description={`${recipient.fullName.split(" ")[0]} or someone else will be there to receive the delivery.`}
                checked={recipientAvail === "available"}
                onChange={() => setRecipientAvail("available")}
                icon={<UserCheck size={14} />}
              />
              <AvailabilityRadio
                label="No, please contact the recipient before delivery"
                description="We'll call ahead to coordinate before the driver arrives."
                checked={recipientAvail === "contact_first"}
                onChange={() => setRecipientAvail("contact_first")}
                icon={<MessageCircle size={14} />}
              />
            </div>
          </div>

          <div>
            <label className="block">
              <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-2">
                Preferred delivery time or special instructions{" "}
                <span className="text-charcoal-400 font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </p>
              <textarea
                value={specialInstructions}
                onChange={(e) =>
                  setSpecialInstructions(e.target.value.slice(0, 240))
                }
                placeholder="e.g. After 1pm please, gate code 4221, leave with security if no one answers."
                className="input-base min-h-[80px] resize-none"
                rows={3}
                maxLength={240}
              />
              <p className="text-[10px] text-charcoal-400 mt-1 text-right tabular-nums">
                {specialInstructions.length}/240
              </p>
            </label>
          </div>

          <p className="text-[11px] text-charcoal-700 mt-3 leading-snug bg-cream-100 rounded-2xl px-3 py-2">
            We'll do our best to accommodate your request, but exact delivery
            times cannot be guaranteed.
          </p>
        </section>

        {/* Confirmation / CTA */}
        {confirmed || isOnWaitlist ? (
          <section className="card-base p-5 mb-4 bg-sage-100 border-sage-300">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-sage-500 text-cream-50 shrink-0">
                <CheckCircle2 size={20} />
              </span>
              <div className="min-w-0">
                <p className="display font-semibold text-lg text-sage-700 leading-tight">
                  You're on the launch list
                </p>
                <p className="text-sm text-charcoal-700 mt-1 leading-relaxed">
                  We'll email <span className="font-semibold">{user.email}</span>{" "}
                  the moment KAYA opens for orders. Your basket and people
                  are saved — nothing to do until launch day.
                </p>
                {scheduleSummary && (
                  <div className="mt-3 rounded-2xl bg-white/80 border border-sage-300/40 px-3 py-2 text-xs text-charcoal-700 flex items-start gap-2">
                    <CalendarDays
                      size={12}
                      className="mt-0.5 text-sage-700 shrink-0"
                    />
                    <span>
                      <span className="font-semibold">Preferred window:</span>{" "}
                      {formatScheduledDate(scheduleSummary.date)} ·{" "}
                      {scheduleSummary.windowLabel} (
                      {scheduleSummary.windowRangeLabel})
                      {scheduleSummary.recipientAvailable ===
                        "contact_first" && (
                        <span className="text-charcoal-400">
                          {" "}· contact recipient first
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="card-base p-5 mb-4 bg-mustard-100 border-mustard-400/60">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0">
                <Bell size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="display font-semibold text-lg text-charcoal-900 leading-tight">
                  Be among the first families
                </p>
                <p className="text-sm text-charcoal-700 mt-1 leading-relaxed">
                  Confirm the email below to lock in your launch-day alert.
                  We'll only message you about KAYA going live.
                </p>
                <p className="text-xs font-semibold text-charcoal-900 mt-2 truncate">
                  {user.email}
                </p>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="btn-primary mt-3"
                >
                  <Heart size={14} /> Save my spot
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Referral nudge */}
        {user.referralCode && (
          <section className="card-base p-4 mb-4">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-400">
              Share KAYA · Earn GH₵{20}
            </p>
            <p className="display font-semibold text-lg mt-0.5">
              Bring a friend along
            </p>
            <p className="text-xs text-charcoal-400 mt-1 leading-relaxed">
              Friends who sign up with your code earn you GH₵{20} credit when
              they place their first order at launch.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 rounded-2xl bg-cream-100 border border-charcoal-100 px-4 py-3 text-center display font-bold tracking-[0.4em] text-charcoal-900">
                {user.referralCode}
              </div>
              <Link
                to="/profile"
                className="btn-outline shrink-0"
                aria-label="Manage referrals"
              >
                Share <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        )}

        <section className="card-base p-4 mb-4 bg-cream-100 border-charcoal-100/60">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white text-sage-700 shrink-0">
              <ShieldCheck size={16} />
            </span>
            <div className="text-xs text-charcoal-700 leading-relaxed">
              <p className="font-semibold text-charcoal-900 mb-1">
                No charges until launch
              </p>
              KAYA isn't taking payments yet. We won't ask for card details
              until we're ready to deliver care to your loved ones in Accra
              & Tema.
            </div>
          </div>
        </section>

        {/* Ghana-first pricing disclosure — KAYA charges in GHS so
            what the customer sees is what we settle, but their bank
            or card provider may convert the GHS charge into their
            local currency. Surfaced here so it's impossible to miss
            before committing to a launch reservation. */}
        <section className="card-base p-4 mb-4 bg-white border-charcoal-100">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-cream-100 text-mustard-600 shrink-0 display font-bold text-sm">
              GH₵
            </span>
            <div className="text-xs text-charcoal-700 leading-relaxed">
              <p className="font-semibold text-charcoal-900 mb-1">
                Charged in Ghana Cedis (GH₵)
              </p>
              Every KAYA price — items, delivery, care packages — is
              shown and charged in GH₵. Your bank or card provider may
              convert this charge into your local currency at their own
              exchange rate.
            </div>
          </div>
        </section>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => navigate("/")}
            className="btn-outline flex-1"
          >
            Back home
          </button>
          <button
            onClick={() => navigate("/cart")}
            className="btn-primary flex-1"
          >
            Edit basket
          </button>
        </div>
      </main>
    </>
  );
}

function PrefRadio({
  label,
  description,
  checked,
  onChange,
  recommended,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  recommended?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border px-3 py-3 cursor-pointer transition ${
        checked
          ? "border-charcoal-800 bg-cream-100"
          : "border-charcoal-100 bg-white hover:border-charcoal-400"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1 w-4 h-4 accent-charcoal-800"
      />
      <span className="flex-1">
        <span className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          {label}
          {recommended && (
            <span className="rounded-full bg-sage-100 text-sage-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
              Recommended
            </span>
          )}
        </span>
        <span className="text-[11px] text-charcoal-400 leading-snug block mt-0.5">
          {description}
        </span>
      </span>
    </label>
  );
}

function DateChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-charcoal-800 bg-charcoal-800 text-cream-50"
          : "border-charcoal-100 bg-white hover:border-charcoal-400"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {label}
    </button>
  );
}

function AvailabilityRadio({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border px-3 py-3 cursor-pointer transition ${
        checked
          ? "border-charcoal-800 bg-cream-100"
          : "border-charcoal-100 bg-white hover:border-charcoal-400"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1 w-4 h-4 accent-charcoal-800"
      />
      <span
        className={`grid place-items-center w-8 h-8 rounded-xl shrink-0 ${
          checked
            ? "bg-charcoal-800 text-mustard-400"
            : "bg-cream-100 text-charcoal-700"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-sm font-semibold block">{label}</span>
        <span className="text-[11px] text-charcoal-400 leading-snug block mt-0.5">
          {description}
        </span>
      </span>
    </label>
  );
}
