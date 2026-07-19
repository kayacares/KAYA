
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronUp,
  Clock,
  Heart,
  Info,
  Package,
  Plus,
  RotateCw,
  Sparkles,
  Users,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import RecipientCard from "@/components/features/RecipientCard";
import AddRecipientSheet from "@/components/features/AddRecipientSheet";
import ReferralSourceSheet from "@/components/features/ReferralSourceSheet";
import PreLaunchBanner from "@/components/features/PreLaunchBanner";
import CurrencySelector from "@/components/features/CurrencySelector";
import CarePackageCard from "@/components/features/CarePackageCard";
import StatusBadge from "@/components/features/StatusBadge";
import OptimizedImage from "@/components/features/OptimizedImage";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { formatCurrency, formatGHS } from "@/lib/currency";
import { relativeTime } from "@/lib/utils";
import {
  isCarePackageDeliverable,
  isCarePackageVisible,
  getPackageFulfillment,
} from "@/lib/carePackages";
import type { CarePackage, Order, Recipient } from "@/types";

export default function Home() {
  const {
    user,
    recipients,
    orders: allOrders,
    products,
    shops,
    carePackages,
    deliveryAreas,
    refreshDeliveryAreas,
    addToCart,
    setActiveRecipient,
  } = useApp();

  // ⚠️ FRESH-BROWSER GUARANTEE (fixed 2026-Q3, do not regress):
  // On a completely new browser with no cache, localStorage is
  // empty and initial state starts as []. The AppContext sync
  // polls delivery areas on mount, but it's async — the customer
  // may reach the Add Recipient sheet before that fetch lands.
  // Force a fresh fetch here on every Home mount so the customer
  // dropdown reflects the latest admin catalog regardless of
  // cache state or sync timing. Wrapped in .catch() because
  // refreshDeliveryAreas now throws on failure — Home stays
  // silent, the sheet surfaces the error with a retry.
  //
  // Stable-ref pattern: refreshDeliveryAreas is recreated on
  // every AppContext state change (it lives inside a useMemo),
  // so gating this effect on its identity fires it on every
  // parent state update — which on mobile can cause the fetch
  // to be cancelled mid-flight, or hammer the network. Use a
  // ref so we always call the latest version but the effect
  // itself only fires once on mount.
  const refreshDeliveryAreasRef = useRef(refreshDeliveryAreas);
  useEffect(() => {
    refreshDeliveryAreasRef.current = refreshDeliveryAreas;
  }, [refreshDeliveryAreas]);
  useEffect(() => {
    console.log("[KAYA] Home mount → fetching delivery areas…");
    void refreshDeliveryAreasRef
      .current()
      .catch((err) => {
        console.warn(
          "[KAYA] Home refreshDeliveryAreas failed (mobile network?):",
          err
        );
      });
  }, []);
  const orders = useMemo(
    () => (user ? allOrders.filter((o) => o.senderId === user.id) : []),
    [allOrders, user]
  );
  const [addOpen, setAddOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [feesOpen, setFeesOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const firstName =
    user?.firstName ?? user?.name?.split(" ")[0] ?? "Friend";
  const currency = user?.currency ?? "GHS";

  useEffect(() => {
    const state =
      (location.state as
        | { welcomeBack?: boolean; firstName?: string }
        | null) ?? null;
    if (state?.welcomeBack) {
      const name = state.firstName ?? firstName;
      toast(`Welcome back, ${name}`, {
        description: "Your loved ones missed you \u2764\uFE0F",
        duration: 4500,
      });
      // Prevent the toast from re-firing on refresh
      window.history.replaceState({}, "");
    }
  }, [location.state, firstName]); // Added firstName and location.state to dependency array

  // Post-onboarding referral prompt — optional, one-time, customers only.
  useEffect(() => {
    if (!user) return;
    const role = user.role ?? "customer";
    if (role !== "customer") return;
    if (user.referralPromptedAt) return;
    const t = window.setTimeout(() => setReferralOpen(true), 1200);
    return () => window.clearTimeout(t);
  }, [user?.id, user?.role, user?.referralPromptedAt]);

  const ranked = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      counts[o.recipient.id] = (counts[o.recipient.id] || 0) + 1;
    }
    return [...recipients]
      .map((r) => ({ recipient: r, count: counts[r.id] || 0 }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return (
          new Date(b.recipient.createdAt).getTime() -
          new Date(a.recipient.createdAt).getTime()
        );
      });
  }, [recipients, orders]);

  const topRecipients = ranked.slice(0, 3);
  const remaining = Math.max(0, recipients.length - topRecipients.length);
  const defaultRecipientId = topRecipients[0]?.recipient.id;

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 4),
    [orders]
  );

  const recommendations = useMemo(() => {
    if (recipients.length === 0)
      return [] as { bundle: CarePackage; reason: string }[];

    type Rec = { bundle: CarePackage; reason: string };
    const recs: Rec[] = [];
    const seen = new Set<string>();

    const tryAdd = (pkgId: string, reason: string) => {
      if (seen.has(pkgId)) return;
      const bundle = carePackages.find((b) => b.id === pkgId);
      if (!bundle) return;
      if (!isCarePackageVisible(bundle)) return;
      seen.add(pkgId);
      recs.push({ bundle, reason });
    };

    const firstNameOf = (full: string) => full.split(" ")[0];

    // Personalize based on saved recipients
    const mom = recipients.find((r) => r.relationship === "Mom");
    if (mom)
      tryAdd(
        "cp_mom_basket",
        `Stock ${firstNameOf(mom.fullName)}'s pantry`
      );

    const grandma = recipients.find((r) => r.relationship === "Grandma");
    if (grandma)
      tryAdd(
        "cp_mom_basket",
        `A monthly basket for ${firstNameOf(grandma.fullName)}`
      );

    const family = recipients.find((r) => r.relationship === "Family Home");
    if (family)
      tryAdd(
        "cp_family_essentials",
        `Keep the ${family.city} household stocked`
      );

    const student = recipients.find((r) => r.relationship === "Student");
    if (student)
      tryAdd(
        "cp_family_essentials",
        `Refill the basics for ${firstNameOf(student.fullName)}`
      );

    // Celebration is universally meaningful — tie to a real recipient
    const surpriseFor = recipients[0];
    if (surpriseFor)
      tryAdd(
        "cp_birthday",
        `Surprise ${firstNameOf(surpriseFor.fullName)} with a smile`
      );

    // Gentle re-engagement: send again what they've sent before
    const lastBundleOrder = orders.find((o) => o.bundleId);
    if (lastBundleOrder?.bundleId) {
      tryAdd(
        lastBundleOrder.bundleId,
        `Send another to ${firstNameOf(lastBundleOrder.recipient.fullName)}`
      );
    }

    // Round out with thoughtful, non-promotional picks
    tryAdd("cp_new_baby", "Loved by new parents in our community");
    tryAdd("cp_birthday", "Perfect for marking a special day");
    tryAdd("cp_new_mother", "Care for a new mum in your life");

    return recs.slice(0, 4);
  }, [recipients, orders, carePackages]);

  const careReminders = useMemo(() => {
    const REMINDER_DAYS = 21;
    const now = Date.now();
    const thresholdMs = REMINDER_DAYS * 24 * 60 * 60 * 1000;

    const lastByRecipient = new Map<string, Order>();
    for (const o of orders) {
      const existing = lastByRecipient.get(o.recipient.id);
      if (
        !existing ||
        new Date(o.createdAt).getTime() >
          new Date(existing.createdAt).getTime()
      ) {
        lastByRecipient.set(o.recipient.id, o);
      }
    }

    type Reminder = {
      recipient: Recipient;
      lastOrder: Order;
      daysSince: number;
    };
    const reminders: Reminder[] = [];
    for (const r of recipients) {
      const last = lastByRecipient.get(r.id);
      if (!last) continue;
      const ms = now - new Date(last.createdAt).getTime();
      if (ms < thresholdMs) continue;
      reminders.push({
        recipient: r,
        lastOrder: last,
        daysSince: Math.floor(ms / (24 * 60 * 60 * 1000)),
      });
    }
    reminders.sort((a, b) => b.daysSince - a.daysSince);
    return reminders.slice(0, 3);
  }, [recipients, orders]);

  // Care packages use a fixed customer-facing priceGHS set by admins
  // in the Care Packages tab (auto-suggested from items × sellingPrice).
  const bundleTotalGHS = (pkg: CarePackage) => pkg.priceGHS;

  // Surface featured + active care packages on the home grid. Filter
  // out anything that's currently undeliverable to the first chosen
  // recipient or has every item unavailable.
  const firstRecipient = ranked[0]?.recipient ?? null;
  const visibleCarePackages = useMemo(() => {
    return carePackages
      .filter((p) => isCarePackageVisible(p))
      .filter((p) =>
        isCarePackageDeliverable(p, firstRecipient, deliveryAreas)
      )
      .filter((p) => {
        const ff = getPackageFulfillment(p, products);
        return !ff.unfulfillable;
      })
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [carePackages, products, firstRecipient, deliveryAreas]);

  const handleReorder = (order: Order) => {
    setActiveRecipient(order.recipient.id);
    for (const it of order.items) {
      addToCart(it.productId, it.quantity);
    }
    navigate("/cart");
  };

  return (
    <>
      <TopBar right={<CurrencySelector />} />
      <main className="container-app px-4 pt-2">
        <div className="mb-8 animate-fade-in-up">
          <PreLaunchBanner className="mb-4" />
          <div className="inline-flex items-center gap-1.5 rounded-full bg-mustard-400 text-charcoal-900 px-3 py-1.5 text-xs font-bold mb-4 shadow-cta">
            <Sparkles size={12} /> Send care, not just cash
          </div>
          <h1 className="h-display">
            Who are you <br />
            caring for today, <br />
            <span className="text-mustard-500">{firstName}?</span>
          </h1>
        </div>

        {/* Recipients */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="eyebrow-muted">Your people</h2>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-charcoal-900 bg-white border border-charcoal-100 rounded-full px-3 py-1.5 hover:bg-cream-100 hover:border-charcoal-400 transition"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {recipients.length === 0 ? (
            <div className="card-base p-8 text-center">
              <div className="text-5xl mb-2">💛</div>
              <p className="display text-xl font-semibold">
                Add your first loved one
              </p>
              <p className="text-sm text-charcoal-400 mt-1">
                Save their address once. Send care anytime.
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="btn-primary mt-5"
              >
                <Plus size={16} /> Add a recipient
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {topRecipients.map(({ recipient, count }) => (
                  <RecipientCard
                    key={recipient.id}
                    recipient={recipient}
                    compact
                    orderCount={count}
                  />
                ))}
              </div>
              {remaining > 0 && (
                <Link
                  to="/recipients"
                  className="mt-3 flex items-center justify-between gap-2 w-full rounded-2xl border border-charcoal-100 bg-white px-4 py-3 text-sm font-semibold text-charcoal-900 hover:border-charcoal-400 transition"
                >
                  <span className="flex items-center gap-2">
                    <span className="grid place-items-center w-7 h-7 rounded-full bg-cream-100">
                      <Users size={14} className="text-mustard-600" />
                    </span>
                    View all {recipients.length} people
                  </span>
                  <ArrowRight size={16} className="text-charcoal-400" />
                </Link>
              )}
            </>
          )}
        </section>

        {/* Care reminders */}
        {careReminders.length > 0 && (
          <section className="mb-8">
            <div className="mb-3">
              <h2 className="eyebrow-muted">A gentle nudge</h2>
              <p className="text-xs text-charcoal-400 mt-1">
                It's been a while since these loved ones got care.
              </p>
            </div>
            <div className="space-y-2">
              {careReminders.map(({ recipient, lastOrder, daysSince }) => {
                const lastBundle = lastOrder.bundleId
                  ? carePackages.find((b) => b.id === lastOrder.bundleId)
                  : null;
                const lastShop = shops.find((s) => s.id === lastOrder.shopId);
                const firstNameOfR = recipient.fullName.split(" ")[0];
                return (
                  <div
                    key={recipient.id}
                    className="card-base p-4 bg-mustard-100/70 border-mustard-400/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid place-items-center w-12 h-12 rounded-2xl bg-white text-2xl shrink-0 shadow-soft">
                        {recipient.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-mustard-700 flex items-center gap-1">
                          <Clock size={10} /> {daysSince} days since last care
                        </p>
                        <p className="font-semibold text-sm mt-0.5 truncate">
                          Check in on {firstNameOfR}
                        </p>
                        <p className="text-xs text-charcoal-700 mt-0.5 line-clamp-1">
                          Last sent:{" "}
                          {lastBundle
                            ? lastBundle.name
                            : `${lastOrder.items.length} ${
                                lastOrder.items.length === 1 ? "item" : "items"
                              } from ${lastShop?.name ?? "the shop"}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleReorder(lastOrder)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-charcoal-900 hover:bg-charcoal-700 text-cream-50 px-3.5 py-2 text-xs font-bold transition shadow-soft active:scale-95"
                        aria-label={`Send last basket again to ${recipient.fullName}`}
                      >
                        <RotateCw size={13} />
                        Send again
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Delivery notice */}
        <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-start gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-white text-emerald-600 shrink-0 shadow-soft">
            <Package size={16} />
          </span>
          <p className="text-xs text-emerald-700 leading-relaxed pt-1 font-medium">
            Thoughtful gifts, essentials, and everyday care delivered to the
            people who matter most in Accra & Tema.
          </p>
        </div>

        {/* Shops */}
        <section className="mb-8">
          <div className="flex items-end justify-between mb-3 gap-3">
            <div>
              <h2 className="eyebrow">Browse the shops</h2>
              <p className="h3 mt-1">Where should we shop today?</p>
            </div>
          </div>
          {/* Shop delivery fee notice — friendly, informational. Sits
              right above the shop grid so customers understand why
              different shops carry separate delivery charges before
              they tap in. Tap the info chevron to expand a per-shop
              fee breakdown so they can preview costs without opening
              every store. */}
          <div className="mb-3 rounded-2xl bg-cream-100 border border-charcoal-100 overflow-hidden">
            <div className="px-3.5 py-2.5 flex items-start gap-2.5">
              <span
                className="grid place-items-center w-7 h-7 rounded-lg bg-white text-mustard-600 shrink-0"
                aria-hidden
              >
                <Package size={14} />
              </span>
              <p className="flex-1 text-[12px] sm:text-xs text-charcoal-700 leading-snug pt-0.5">
                Each shop has its own delivery fee. You can shop from
                multiple shops, and delivery fees will be shown clearly
                at checkout.
              </p>
              {shops.filter((s) => s.active).length > 0 && (
                <button
                  type="button"
                  onClick={() => setFeesOpen((o) => !o)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white text-charcoal-700 hover:text-charcoal-900 hover:bg-cream-200 transition px-2 py-1 text-[11px] font-semibold border border-charcoal-100"
                  aria-expanded={feesOpen}
                  aria-controls="shop-fee-breakdown"
                  aria-label={
                    feesOpen
                      ? "Hide delivery fees by shop"
                      : "View delivery fees by shop"
                  }
                >
                  {feesOpen ? (
                    <>
                      Hide <ChevronUp size={11} />
                    </>
                  ) : (
                    <>
                      <Info size={11} /> Fees
                    </>
                  )}
                </button>
              )}
            </div>
            {feesOpen && (
              <div
                id="shop-fee-breakdown"
                className="px-3.5 pb-3 pt-1 border-t border-charcoal-100/80 animate-fade-in-up"
              >
                <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mt-2 mb-2">
                  Delivery fees by shop
                </p>
                <ul className="space-y-1.5">
                  {shops
                    .filter((s) => s.active)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{s.emoji}</span>
                          <span className="font-semibold text-charcoal-900 truncate">
                            {s.name}
                          </span>
                        </span>
                        <span
                          className={`font-bold tabular-nums shrink-0 ${
                            s.deliveryFeeGHS > 0
                              ? "text-charcoal-900"
                              : "text-sage-700"
                          }`}
                        >
                          {s.deliveryFeeGHS > 0
                            ? formatGHS(s.deliveryFeeGHS)
                            : "Free"}
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="text-[10px] text-charcoal-400 mt-2.5 leading-snug">
                  Shopping from more than one shop? Fees combine cleanly
                  in your cart — nothing surprise at checkout.
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {shops.filter((s) => s.active).map((s, idx) => (
              <Link
                key={s.id}
                to={
                  defaultRecipientId
                    ? `/recipient/${defaultRecipientId}/shop/${s.id}`
                    : `/shop/${s.id}`
                }
                className="group relative overflow-hidden rounded-3xl bg-white border border-charcoal-100/70 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {s.image ? (
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <OptimizedImage
                      src={s.image}
                      alt=""
                      size="shopCard"
                      priority={idx < 2}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/40 to-charcoal-900/10"
                      aria-hidden
                    />
                    <div className="absolute top-0 inset-x-0 p-5 flex items-start justify-between">
                      <div className="text-5xl drop-shadow-lg">{s.emoji}</div>
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-white/25 backdrop-blur-md ring-1 ring-white/30 group-hover:bg-mustard-400 group-hover:ring-mustard-400 transition-all">
                        <ArrowUpRight
                          size={17}
                          className="text-cream-50 group-hover:text-charcoal-900 transition-colors"
                        />
                      </span>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-5 text-cream-50">
                      <div className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-300 drop-shadow">
                        {s.tagline}
                      </div>
                      <h3 className="display text-xl sm:text-2xl font-bold leading-tight mt-1 drop-shadow-md">
                        {s.name}
                      </h3>
                    </div>
                  </div>
                ) : (
                  <div className={`relative ${s.accent} p-5`}>
                    <div className="flex items-start justify-between">
                      <div className="text-5xl">{s.emoji}</div>
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-white/30 backdrop-blur group-hover:bg-white/60 transition">
                        <ArrowUpRight size={17} />
                      </span>
                    </div>
                    <h3 className="display text-xl font-bold mt-3 leading-tight">
                      {s.name}
                    </h3>
                    <p className="text-xs mt-1 opacity-90">{s.tagline}</p>
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-sm text-charcoal-700 leading-relaxed line-clamp-2 flex-1">
                    {s.description}
                  </p>
                  <div className="mt-3">
                    {s.minOrderGHS > 0 ? (
                      <span className="chip bg-cream-100 text-charcoal-700">
                        Min order {formatGHS(s.minOrderGHS)}
                      </span>
                    ) : (
                      <span className="chip-success">No minimum</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Care Packages */}
        {visibleCarePackages.length > 0 && (
          <section className="mb-8">
            <div className="flex items-end justify-between mb-3 gap-3">
              <div>
                <h2 className="eyebrow">Care Packages</h2>
                <p className="h3 mt-1">Ready-to-send gifts</p>
                <p className="text-xs text-charcoal-400 mt-1">
                  {firstRecipient
                    ? `Curated gifts that ship to ${firstRecipient.fullName.split(" ")[0]}'s area.`
                    : "Curated, ready-to-send gifts — tap to view."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleCarePackages.map((pkg) => (
                <CarePackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </section>
        )}

        {/* Recent orders */}
        {recentOrders.length > 0 && (
          <section className="mb-8">
            <div className="flex items-end justify-between mb-3 gap-3">
              <div>
                <h2 className="eyebrow-muted">Recent care sent</h2>
                <p className="text-xs text-charcoal-400 mt-1">
                  Tap reorder to send the same again in one tap.
                </p>
              </div>
              <Link
                to="/orders"
                className="text-xs font-semibold text-charcoal-900 hover:underline shrink-0"
              >
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div
                  key={o.id}
                  className="card-base p-4 hover:border-charcoal-400 transition"
                >
                  <div className="flex items-start gap-3">
                    <Link
                      to={`/orders/${o.id}`}
                      className="flex items-start gap-3 flex-1 min-w-0"
                    >
                      <div className="grid place-items-center w-11 h-11 rounded-2xl bg-cream-100 text-2xl shrink-0">
                        {o.recipient.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">
                            For {o.recipient.fullName}
                          </p>
                          <StatusBadge status={o.status} />
                        </div>
                        <p className="text-xs text-charcoal-400 mt-0.5">
                          {relativeTime(o.createdAt)} · {o.items.length}{" "}
                          {o.items.length === 1 ? "item" : "items"}
                        </p>
                        <p className="display font-bold text-base mt-1">
                          {formatCurrency(o.totalGHS, currency)}
                        </p>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleReorder(o)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-mustard-400 hover:bg-mustard-500 text-charcoal-900 px-4 py-2 text-xs font-bold transition-all shadow-cta hover:shadow-cta-hover active:scale-95"
                      aria-label={`Reorder for ${o.recipient.fullName}`}
                    >
                      <RotateCw size={13} />
                      Reorder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommended for your loved ones */}
        {recommendations.length > 0 && (
          <section className="mb-10">
            <div className="mb-3">
              <h2 className="eyebrow-muted">Recommended for your loved ones</h2>
              <p className="text-xs text-charcoal-400 mt-1">
                Thoughtful picks chosen for the people you care for.
              </p>
            </div>
            <div className="space-y-2">
              {recommendations.map((rec, i) => {
                const totalGHS = bundleTotalGHS(rec.bundle);
                return (
                  <Link
                    key={`${rec.bundle.id}_${i}`}
                    to={`/care-package/${rec.bundle.id}`}
                    className="card-base p-0 overflow-hidden flex items-stretch hover:border-charcoal-400 hover:shadow-card transition group"
                  >
                    <div
                      className={`shrink-0 w-24 grid place-items-center ${rec.bundle.accent}`}
                    >
                      <span className="text-4xl">{rec.bundle.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0 p-3.5">
                      <p className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-600 flex items-center gap-1">
                        <Heart size={10} fill="currentColor" /> {rec.reason}
                      </p>
                      <p className="font-display font-semibold text-[15px] mt-1 truncate text-charcoal-900">
                        {rec.bundle.name}
                      </p>
                      <p className="text-xs text-charcoal-400 mt-0.5 line-clamp-1">
                        {rec.bundle.shortDescription}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="display font-bold text-base text-charcoal-900 tabular-nums">
                          {formatCurrency(totalGHS, currency)}
                        </span>
                        <span className="grid place-items-center w-8 h-8 rounded-full bg-cream-100 group-hover:bg-mustard-400 group-hover:shadow-cta text-charcoal-900 transition-all shrink-0">
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <AddRecipientSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <ReferralSourceSheet
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
      />
    </>
  );
}
