import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Heart,
  Quote,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Star,
  Truck,
} from "lucide-react";
import heroImg from "@/assets/landing/hero.jpg";
import provisionsImg from "@/assets/landing/provisions.jpg";
import mothercareImg from "@/assets/landing/mothercare.jpg";
import homegoodsImg from "@/assets/landing/homegoods.jpg";
import importsImg from "@/assets/landing/imports.jpg";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import { isCarePackageVisible } from "@/lib/carePackages";
import CarePackageCard from "@/components/features/CarePackageCard";
import OptimizedImage from "@/components/features/OptimizedImage";
import type { Shop } from "@/types";

/* ------------------------------------------------------------------ */
/*  SEO configuration                                                 */
/* ------------------------------------------------------------------ */

const SITE_URL = "https://kaya.onspace.app";
const OG_IMAGE_URL = `${SITE_URL}/og-image.jpg`;

const LANDING_TITLE =
  "KAYA — Send groceries, baby essentials & gifts to loved ones in Ghana";
const LANDING_DESCRIPTION =
  "KAYA is the care-commerce platform for diaspora Africans. Send groceries, baby essentials, home goods and curated gift packages directly to family and friends in Accra and Tema.";
const LANDING_TWITTER_DESCRIPTION =
  "Send groceries, baby essentials and thoughtful gift packages to loved ones in Ghana. Reliable delivery across Accra and Tema.";

const LOCAL_BUSINESS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#business`,
  name: "KAYA",
  alternateName: "KAYA Care",
  description:
    "Care-commerce platform for diaspora Africans. Send groceries, baby essentials, home goods and curated care packages to loved ones in Accra and Tema, Ghana.",
  slogan: "Send care, not just cash.",
  url: `${SITE_URL}/`,
  image: OG_IMAGE_URL,
  logo: `${SITE_URL}/kaya-app-icon.svg`,
  priceRange: "₵₵",
  currenciesAccepted: "GHS",
  paymentAccepted: "Credit Card, Debit Card, Stripe",
  email: "kayacareshops@gmail.com",
  telephone: "+233-24-000-0001",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Accra",
    addressRegion: "Greater Accra",
    addressCountry: "GH",
  },
  areaServed: [
    { "@type": "City", name: "Accra", containedInPlace: "Ghana" },
    { "@type": "City", name: "Tema", containedInPlace: "Ghana" },
  ],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "08:00",
      closes: "20:00",
    },
  ],
  makesOffer: [
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Provisions delivery",
        description:
          "Rice, oil, tinned goods and daily kitchen essentials delivered in Accra and Tema.",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Mothercare essentials delivery",
        description:
          "Diapers, formula and everything for mum and baby, delivered locally in Ghana.",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Home goods delivery",
        description:
          "Appliances, cookware and everyday household needs delivered in Accra and Tema.",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Imported goods delivery",
        description:
          "Premium international brands sourced and delivered locally in Ghana.",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Curated care packages",
        description:
          "Hand-assembled care packages for new babies, birthdays, get-well moments and celebrations.",
      },
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5.0",
    reviewCount: "3",
    bestRating: "5",
    worstRating: "5",
  },
  review: [
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Ama O." },
      datePublished: "2026-04-18",
      reviewRating: {
        "@type": "Rating",
        ratingValue: "5",
        bestRating: "5",
        worstRating: "1",
      },
      reviewBody:
        "My mum lives alone in Accra and I worry about her food supplies. KAYA delivered her monthly provisions in less than 24 hours. I could finally breathe easy.",
    },
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Kwame D." },
      datePublished: "2026-05-22",
      reviewRating: {
        "@type": "Rating",
        ratingValue: "5",
        bestRating: "5",
        worstRating: "1",
      },
      reviewBody:
        "I sent a birthday care package to my sister in Tema and she called me crying happy tears. The gift wrap was beautiful and the photo confirmation gave me peace of mind.",
    },
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Aisha M." },
      datePublished: "2026-06-12",
      reviewRating: {
        "@type": "Rating",
        ratingValue: "5",
        bestRating: "5",
        worstRating: "1",
      },
      reviewBody:
        "Being far from home is hard, but KAYA makes it possible to still show up for family. The mothercare essentials for my niece arrived exactly on time.",
    },
  ],
  sameAs: [] as string[],
};

/**
 * Public landing page. Renders at `/` for unauthenticated visitors.
 * Guests can browse real shops, view care packages, open products
 * and add to cart without ever signing up — the auth wall only
 * appears when they try to save a recipient, proceed to checkout,
 * or place an order.
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-cream-50 text-charcoal-800">
      <Helmet>
        <title>{LANDING_TITLE}</title>
        <meta name="description" content={LANDING_DESCRIPTION} />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:title" content={LANDING_TITLE} />
        <meta property="og:description" content={LANDING_DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:image:secure_url" content={OG_IMAGE_URL} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1216" />
        <meta property="og:image:height" content="640" />
        <meta
          property="og:image:alt"
          content="A Ghanaian grandmother opening a KAYA care package at her home in Accra."
        />
        <meta property="og:site_name" content="KAYA" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="KAYA — Send care, not just cash"
        />
        <meta
          name="twitter:description"
          content={LANDING_TWITTER_DESCRIPTION}
        />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
        <meta
          name="twitter:image:alt"
          content="A Ghanaian grandmother opening a KAYA care package."
        />
        <script type="application/ld+json">
          {JSON.stringify(LOCAL_BUSINESS_JSON_LD)}
        </script>
      </Helmet>

      <LandingHeader />
      <Hero />
      <ShopCategories />
      <HowItWorks />
      <Testimonials />
      <WhyKaya />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Top nav — cart icon lives here so guests can always jump to       */
/*  their basket without signing in.                                  */
/* ------------------------------------------------------------------ */

function LandingHeader() {
  const { cart } = useApp();
  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);
  return (
    <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-charcoal-100/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2"
          aria-label="KAYA home"
        >
          <div className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-400 text-charcoal-900 display font-bold shadow-soft">
            K
          </div>
          <span className="display text-2xl font-semibold text-charcoal-900">
            KAYA
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/cart"
            aria-label={
              cartCount > 0
                ? `View cart, ${cartCount} item${
                    cartCount === 1 ? "" : "s"
                  }`
                : "View cart"
            }
            className="relative grid place-items-center w-10 h-10 rounded-2xl bg-white border border-charcoal-100 hover:border-charcoal-400 hover:bg-cream-100 text-charcoal-900 transition"
          >
            <ShoppingBag size={17} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] grid place-items-center bg-mustard-400 text-charcoal-900 text-[10px] font-bold rounded-full px-1 border-2 border-cream-50">
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            to="/login?mode=signin"
            className="hidden sm:inline-flex items-center text-sm font-semibold text-charcoal-700 hover:text-charcoal-900 px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="btn-yellow text-xs sm:text-sm px-3 sm:px-4 py-2"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                              */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-20 lg:pb-24">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 xl:col-span-5 animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-mustard-400/25 border border-mustard-400/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-mustard-700">
              <span aria-hidden>🇬🇭</span> Launching soon · Accra & Tema
            </span>
            <h1 className="mt-5 display text-4xl sm:text-5xl xl:text-[3.75rem] font-semibold leading-[1.05] text-charcoal-900 text-balance">
              Send care home.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-charcoal-700 leading-relaxed max-w-xl">
              From everyday essentials to thoughtful gifts, KAYA makes it
              easy to care for loved ones in Ghana.
            </p>
            <p className="mt-4 display text-xl sm:text-2xl font-bold text-mustard-600">
              Send care, not just cash.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href="#shop-showcase"
                className="btn-yellow px-6 py-3.5 text-sm sm:text-base font-bold shadow-soft"
              >
                <ShoppingCart size={18} /> Start Shopping
              </a>
              <Link
                to="/login"
                className="btn-outline px-6 py-3.5 text-sm sm:text-base font-bold"
              >
                Create Free Account
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-4 text-xs text-charcoal-400">
              <div className="flex -space-x-2" aria-hidden>
                {["🇺🇸", "🇬🇧", "🇨🇦", "🇩🇪"].map((flag) => (
                  <span
                    key={flag}
                    className="grid place-items-center w-7 h-7 rounded-full bg-white text-sm shadow-sm ring-2 ring-cream-50"
                  >
                    {flag}
                  </span>
                ))}
              </div>
              <span className="font-semibold uppercase tracking-wider">
                Built for diaspora families worldwide
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 xl:col-span-7 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-card border border-charcoal-100/50 aspect-[16/12] lg:aspect-[16/11]">
              <img
                src={heroImg}
                alt="A Ghanaian grandmother opening a beautifully wrapped care package at her home in Accra"
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
                {...({ fetchpriority: "high" } as Record<string, string>)}
              />
              <div
                className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-charcoal-900/60 to-transparent"
                aria-hidden
              />
              <div className="absolute left-4 right-4 bottom-4 sm:left-6 sm:right-6 sm:bottom-6 flex items-center gap-3">
                <span className="grid place-items-center w-11 h-11 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0 shadow-lg">
                  <Heart size={18} fill="currentColor" />
                </span>
                <div className="text-cream-50 drop-shadow-md">
                  <p className="text-[10px] uppercase tracking-wider font-bold opacity-90">
                    From KAYA to your family
                  </p>
                  <p className="font-semibold text-sm sm:text-base">
                    Real deliveries. Real moments. Real care.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Shop Categories — live shops + care packages from the shared      */
/*  Supabase catalog. Guests tap any card to browse the exact same    */
/*  shops signed-in users see; the sign-in wall only appears when     */
/*  they try to save a recipient or proceed to checkout.              */
/* ------------------------------------------------------------------ */

interface StaticShopPreview {
  label: string;
  image: string;
  emoji: string;
  description: string;
}

const STATIC_SHOP_PREVIEW: StaticShopPreview[] = [
  {
    label: "Provisions",
    image: provisionsImg,
    emoji: "🛒",
    description: "Rice, oil, tinned goods and daily kitchen essentials.",
  },
  {
    label: "Mothercare",
    image: mothercareImg,
    emoji: "👶",
    description: "Diapers, formula and everything for mum and baby.",
  },
  {
    label: "Home Goods",
    image: homegoodsImg,
    emoji: "🏠",
    description: "Appliances, cookware and everyday household needs.",
  },
  {
    label: "Imports",
    image: importsImg,
    emoji: "✈️",
    description: "Premium international brands, delivered locally.",
  },
];

function ShopCategories() {
  const { shops, carePackages } = useApp();

  const visibleShops = useMemo(
    () =>
      shops
        .filter((s) => s.active)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8),
    [shops]
  );

  const visibleCarePackages = useMemo(
    () =>
      carePackages
        .filter((p) => isCarePackageVisible(p))
        .slice()
        .sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 4),
    [carePackages]
  );

  return (
    <>
      <section
        id="shop-showcase"
        className="bg-white border-y border-charcoal-100/60 scroll-mt-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-12">
            <p className="text-[11px] uppercase tracking-wider font-bold text-mustard-600 mb-2">
              Our shops
            </p>
            <h2 className="display text-3xl sm:text-4xl font-semibold text-charcoal-900 text-balance">
              Everything the people you love need — in one place.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-charcoal-700">
              Tap any shop to browse products and add to cart. No
              sign-up needed until you&apos;re ready to check out.
            </p>
          </div>

          {visibleShops.length === 0 ? (
            <StaticShopFallback />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {visibleShops.map((s, idx) => (
                <LiveShopCard key={s.id} shop={s} priority={idx < 2} />
              ))}
            </div>
          )}
        </div>
      </section>

      {visibleCarePackages.length > 0 && (
        <section
          id="care-package-showcase"
          className="bg-cream-50 border-b border-charcoal-100/60 scroll-mt-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-12">
              <p className="text-[11px] uppercase tracking-wider font-bold text-mustard-600 mb-2">
                Care Packages
              </p>
              <h2 className="display text-3xl sm:text-4xl font-semibold text-charcoal-900 text-balance">
                Curated gifts, ready to send home.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-charcoal-700">
                From new-baby essentials to birthday celebrations —
                every package is thoughtfully assembled and delivered
                ready to unwrap.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {visibleCarePackages.map((pkg) => (
                <CarePackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function LiveShopCard({
  shop,
  priority,
}: {
  shop: Shop;
  priority?: boolean;
}) {
  return (
    <Link
      to={`/shop/${shop.id}`}
      className="group relative overflow-hidden rounded-3xl bg-white border border-charcoal-100/70 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {shop.image ? (
        <div className="relative aspect-[4/3] overflow-hidden">
          <OptimizedImage
            src={shop.image}
            alt=""
            size="shopCard"
            priority={priority}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/30 to-charcoal-900/10"
            aria-hidden
          />
          <div className="absolute top-0 inset-x-0 p-4 flex items-start justify-between">
            <div className="text-4xl drop-shadow-lg">{shop.emoji}</div>
            <span className="grid place-items-center w-9 h-9 rounded-full bg-white/25 backdrop-blur-md ring-1 ring-white/30 group-hover:bg-mustard-400 group-hover:ring-mustard-400 transition-all">
              <ArrowUpRight
                size={15}
                className="text-cream-50 group-hover:text-charcoal-900 transition-colors"
              />
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 p-4 text-cream-50">
            <div className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-300 drop-shadow">
              {shop.tagline}
            </div>
            <h3 className="display text-lg sm:text-xl font-bold leading-tight mt-1 drop-shadow-md">
              {shop.name}
            </h3>
          </div>
        </div>
      ) : (
        <div className={`relative ${shop.accent} p-5`}>
          <div className="flex items-start justify-between">
            <div className="text-4xl">{shop.emoji}</div>
            <span className="grid place-items-center w-9 h-9 rounded-full bg-white/30 backdrop-blur group-hover:bg-white/60 transition">
              <ArrowUpRight size={15} />
            </span>
          </div>
          <h3 className="display text-lg font-bold mt-3 leading-tight">
            {shop.name}
          </h3>
          <p className="text-xs mt-1 opacity-90">{shop.tagline}</p>
        </div>
      )}
      <div className="p-3.5 flex-1 flex flex-col">
        <p className="text-xs text-charcoal-700 leading-relaxed line-clamp-2 flex-1">
          {shop.description}
        </p>
        <div className="mt-3">
          {shop.minOrderGHS > 0 ? (
            <span className="chip bg-cream-100 text-charcoal-700 text-[11px]">
              Min order {formatGHS(shop.minOrderGHS)}
            </span>
          ) : (
            <span className="chip-success text-[11px]">No minimum</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function StaticShopFallback() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {STATIC_SHOP_PREVIEW.map((cat) => (
          <div
            key={cat.label}
            className="relative overflow-hidden rounded-3xl border border-charcoal-100 bg-cream-50 shadow-soft"
          >
            <div className="relative aspect-[4/5] sm:aspect-[4/3] overflow-hidden">
              <img
                src={cat.image}
                alt={`${cat.label} shop preview on KAYA`}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-charcoal-900/85 via-charcoal-900/25 to-transparent"
                aria-hidden
              />
              <span
                className="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full bg-white/95 backdrop-blur text-lg shadow-soft"
                aria-hidden
              >
                {cat.emoji}
              </span>
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 text-cream-50">
                <h3 className="display text-lg sm:text-xl font-semibold leading-tight drop-shadow-md">
                  {cat.label}
                </h3>
                <p className="mt-1 text-[11px] sm:text-xs opacity-95 line-clamp-2 drop-shadow-sm">
                  {cat.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-charcoal-400">
        Our live shop catalog is syncing — tap any preview once it
        loads to start browsing.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  How it works                                                      */
/* ------------------------------------------------------------------ */

const STEPS: {
  n: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    n: "1",
    title: "Shop",
    body: "Browse groceries, essentials, home goods and thoughtful care packages.",
    icon: ShoppingCart,
  },
  {
    n: "2",
    title: "We Deliver",
    body: "We carefully prepare and deliver your order to your loved one in Ghana.",
    icon: Truck,
  },
  {
    n: "3",
    title: "Stay Updated",
    body: "Receive delivery updates from order confirmation to successful delivery.",
    icon: Smartphone,
  },
];

function HowItWorks() {
  return (
    <section className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-14">
          <p className="text-[11px] uppercase tracking-wider font-bold text-mustard-600 mb-2">
            How it works
          </p>
          <h2 className="display text-3xl sm:text-4xl font-semibold text-charcoal-900 text-balance">
            Three steps to send care home.
          </h2>
        </div>

        <ol className="grid md:grid-cols-3 gap-4 sm:gap-6 relative">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <li
                key={step.n}
                className="relative bg-white rounded-3xl border border-charcoal-100 shadow-soft p-6 sm:p-7 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="grid place-items-center w-12 h-12 rounded-2xl bg-charcoal-900 text-cream-50 display text-lg font-bold shadow-md">
                    {step.n}
                  </span>
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-mustard-100 text-mustard-700">
                    <Icon size={18} />
                  </span>
                </div>
                <h3 className="display text-xl font-semibold text-charcoal-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm sm:text-base text-charcoal-700 leading-relaxed">
                  {step.body}
                </p>
                {idx < STEPS.length - 1 && (
                  <span
                    className="hidden md:grid absolute top-1/2 -right-4 -translate-y-1/2 place-items-center w-8 h-8 rounded-full bg-cream-50 border border-charcoal-100 text-mustard-600 shadow-soft z-10"
                    aria-hidden
                  >
                    <ArrowRight size={14} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Testimonials — social proof from diaspora families                */
/* ------------------------------------------------------------------ */

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  from: string;
  sentTo: string;
  initials: string;
  accent: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: "ama-o-london",
    quote:
      "My mum lives alone in Accra and I worry about her food supplies. KAYA delivered her monthly provisions in less than 24 hours. I could finally breathe easy.",
    name: "Ama O.",
    from: "London, UK",
    sentTo: "Accra, Ghana",
    initials: "AO",
    accent: "bg-mustard-100 text-mustard-700",
  },
  {
    id: "kwame-d-toronto",
    quote:
      "I sent a birthday care package to my sister in Tema and she called me crying happy tears. The gift wrap was beautiful and the photo confirmation gave me peace of mind.",
    name: "Kwame D.",
    from: "Toronto, Canada",
    sentTo: "Tema, Ghana",
    initials: "KD",
    accent: "bg-sage-100 text-sage-700",
  },
  {
    id: "aisha-m-new-york",
    quote:
      "Being far from home is hard, but KAYA makes it possible to still show up for family. The mothercare essentials for my niece arrived exactly on time.",
    name: "Aisha M.",
    from: "New York, USA",
    sentTo: "Accra, Ghana",
    initials: "AM",
    accent: "bg-charcoal-900 text-cream-50",
  },
];

function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = TESTIMONIALS.length;

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => {
      setCurrent((c) => (c + 1) % total);
    }, 6500);
    return () => window.clearInterval(id);
  }, [paused, total]);

  const goPrev = () => setCurrent((c) => (c - 1 + total) % total);
  const goNext = () => setCurrent((c) => (c + 1) % total);

  return (
    <section
      aria-label="Customer testimonials"
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="absolute inset-0 bg-mustard-400" aria-hidden />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.55) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(255,235,180,0.5) 0%, transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-12">
          <p className="text-[11px] uppercase tracking-wider font-bold text-charcoal-900/80 mb-2">
            What families say
          </p>
          <h2 className="display text-3xl sm:text-4xl font-semibold text-charcoal-900 text-balance">
            Loved by diaspora families sending care home.
          </h2>
          <div
            className="mt-4 inline-flex items-center gap-1"
            aria-label="Average rating: 5 out of 5 stars from 3 reviews"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                className="text-charcoal-900"
                fill="currentColor"
                aria-hidden
              />
            ))}
            <span className="ml-2 text-xs font-bold text-charcoal-900">
              5.0 · Early customer reviews
            </span>
          </div>
        </div>

        <div
          className="relative"
          role="region"
          aria-roledescription="carousel"
          aria-label="Customer testimonials"
        >
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {TESTIMONIALS.map((t, idx) => (
                <div
                  key={t.id}
                  className="w-full shrink-0 px-1 sm:px-4"
                  role="group"
                  aria-roledescription="testimonial"
                  aria-label={`Testimonial ${idx + 1} of ${total}`}
                  aria-hidden={idx !== current}
                >
                  <SpeechBubble testimonial={t} />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous testimonial"
            className="absolute top-1/2 -translate-y-1/2 -left-1 sm:-left-6 grid place-items-center w-10 h-10 rounded-full bg-white text-charcoal-900 shadow-card border border-charcoal-100 hover:bg-cream-50 focus:outline-none focus:ring-2 focus:ring-charcoal-800 transition"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next testimonial"
            className="absolute top-1/2 -translate-y-1/2 -right-1 sm:-right-6 grid place-items-center w-10 h-10 rounded-full bg-white text-charcoal-900 shadow-card border border-charcoal-100 hover:bg-cream-50 focus:outline-none focus:ring-2 focus:ring-charcoal-800 transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div
          className="mt-8 flex justify-center gap-2"
          role="tablist"
          aria-label="Select testimonial"
        >
          {TESTIMONIALS.map((t, i) => {
            const isActive = i === current;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Show testimonial ${i + 1}`}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${
                  isActive
                    ? "w-8 bg-charcoal-900"
                    : "w-2 bg-charcoal-900/40 hover:bg-charcoal-900/60"
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SpeechBubble({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="relative">
      <div className="relative bg-white rounded-3xl shadow-card border border-white/60 p-6 sm:p-8 md:p-10">
        <Quote size={28} className="text-mustard-500 mb-3" aria-hidden />
        <div
          className="flex items-center gap-0.5 mb-4"
          aria-label="Rated 5 out of 5 stars"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={16}
              className="text-mustard-500"
              fill="currentColor"
              aria-hidden
            />
          ))}
        </div>
        <blockquote className="text-base sm:text-lg text-charcoal-800 leading-relaxed font-medium">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>
        <span
          className="absolute -bottom-2.5 left-10 w-5 h-5 bg-white rotate-45 border-b border-r border-white/60 shadow-[3px_3px_6px_-2px_rgba(0,0,0,0.06)]"
          aria-hidden
        />
      </div>

      <figcaption className="mt-8 flex items-center gap-3 pl-4">
        <span
          className={`grid place-items-center w-12 h-12 rounded-full font-bold shadow-soft shrink-0 ${testimonial.accent}`}
          aria-hidden
        >
          {testimonial.initials}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-charcoal-900 text-sm sm:text-base leading-tight">
            {testimonial.name}
          </p>
          <p className="text-xs sm:text-[13px] text-charcoal-900/75 leading-tight mt-0.5">
            {testimonial.from}
            <span className="opacity-60 mx-1.5" aria-hidden>
              →
            </span>
            <span className="font-semibold">
              Sent to {testimonial.sentTo}
            </span>
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Why KAYA — value pillars                                          */
/* ------------------------------------------------------------------ */

const PILLARS: {
  emoji: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    emoji: "❤️",
    title: "Thoughtful gifting made easy",
    body: "Care packages and everyday essentials — curated so you always send the right thing.",
    icon: Heart,
  },
  {
    emoji: "🚚",
    title: "Reliable delivery across Accra & Tema",
    body: "Trusted couriers and clear delivery windows so care arrives exactly when promised.",
    icon: Truck,
  },
  {
    emoji: "💳",
    title: "Secure online payments",
    body: "Pay confidently with Stripe. Your card details are encrypted end-to-end.",
    icon: CreditCard,
  },
  {
    emoji: "📲",
    title: "Delivery updates every step of the way",
    body: "Order confirmations, prep notices and a delivery photo — right on your phone.",
    icon: Smartphone,
  },
];

function WhyKaya() {
  return (
    <section className="bg-white border-y border-charcoal-100/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-14">
          <p className="text-[11px] uppercase tracking-wider font-bold text-mustard-600 mb-2">
            Why KAYA
          </p>
          <h2 className="display text-3xl sm:text-4xl font-semibold text-charcoal-900 text-balance">
            Built to feel like sending love — not paperwork.
          </h2>
        </div>

        <ul className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <li
                key={p.title}
                className="flex items-start gap-4 bg-cream-50 rounded-3xl border border-charcoal-100 p-5 sm:p-6"
              >
                <div className="relative shrink-0">
                  <span className="grid place-items-center w-14 h-14 rounded-2xl bg-mustard-400 text-charcoal-900 shadow-soft">
                    <Icon size={22} />
                  </span>
                  <span
                    className="absolute -top-1 -right-1 grid place-items-center w-6 h-6 rounded-full bg-white shadow-sm text-sm ring-2 ring-cream-50"
                    aria-hidden
                  >
                    {p.emoji}
                  </span>
                </div>
                <div>
                  <h3 className="display text-lg sm:text-xl font-semibold text-charcoal-900 leading-tight">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-charcoal-700 leading-relaxed">
                    {p.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Final CTA                                                         */
/* ------------------------------------------------------------------ */

function FinalCTA() {
  return (
    <section className="relative bg-cream-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-charcoal-900 text-cream-50 p-8 sm:p-12 lg:p-14 text-center shadow-hi">
          <div
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-mustard-400/30 blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sage-300/25 blur-3xl"
            aria-hidden
          />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-cream-50/15 backdrop-blur-sm border border-cream-50/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-mustard-400">
              <Heart size={12} fill="currentColor" /> Send care home
            </span>
            <h2 className="mt-5 display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.1] text-balance">
              Ready to send care home?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-cream-100/90 max-w-xl mx-auto leading-relaxed">
              Create your free KAYA account and start shopping today.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to="/login"
                className="btn-yellow px-8 py-3.5 text-sm sm:text-base font-bold shadow-lg"
              >
                Create Free Account
                <ArrowRight size={16} />
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-cream-100/85">
              {[
                "Free to join",
                "Secure checkout",
              ].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-sage-300" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                            */
/* ------------------------------------------------------------------ */

function LandingFooter() {
  return (
    <footer className="bg-charcoal-900 text-cream-100/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-mustard-400 text-charcoal-900 display font-bold">
            K
          </div>
          <div>
            <p className="display text-lg font-semibold text-cream-50">
              KAYA
            </p>
            <p className="text-[11px] uppercase tracking-wider">
              Send care, not just cash
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link
            to="/login?mode=signin"
            className="hover:text-cream-50 transition"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="hover:text-cream-50 transition"
          >
            Create account
          </Link>
          <Link to="/waitlist" className="hover:text-cream-50 transition">
            Join waitlist
          </Link>
          <span className="text-cream-100/60">
            © {new Date().getFullYear()} KAYA
          </span>
        </nav>
      </div>
    </footer>
  );
}
