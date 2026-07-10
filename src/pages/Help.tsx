import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import {
  ChevronDown,
  CreditCard,
  HelpCircle,
  Package,
  Receipt,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import SupportButton from "@/components/features/SupportButton";
import SupportStatusPill from "@/components/features/SupportStatusPill";

interface FAQ {
  q: string;
  a: string;
}

interface FAQCategory {
  id: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  accent: string;
  faqs: FAQ[];
}

const CATEGORIES: FAQCategory[] = [
  {
    id: "orders",
    label: "Orders",
    description: "Placing, tracking and editing orders.",
    Icon: Package,
    accent: "bg-mustard-100 text-mustard-700",
    faqs: [
      {
        q: "How do I place a KAYA order?",
        a: "Pick a saved loved one, choose a shop, add items or a ready-made bundle, then check out. A KAYA-vetted vendor in Accra or Tema will prepare and deliver — you only ever pay and message KAYA.",
      },
      {
        q: "Can I edit an order after placing it?",
        a: "You can update the recipient's address or add a personal note any time before the order moves to 'Being Prepared'. Open the order page, tap 'Need help?' and KAYA Operations will adjust it for you.",
      },
      {
        q: "Where do I see every order I've sent?",
        a: "The Orders tab in the bottom navigation lists every care package you've ever sent, with live status badges and one-tap Reorder buttons.",
      },
      {
        q: "Can I schedule a delivery for a future date?",
        a: "Gift orders can be scheduled at checkout — choose a delivery date and we'll time the surprise. Provision and Mothercare orders go out the same day.",
      },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Checkout, currencies and payment methods.",
    Icon: CreditCard,
    accent: "bg-sage-100 text-sage-700",
    faqs: [
      {
        q: "Which payment methods does KAYA accept?",
        a: "All major credit and debit cards via Stripe, plus Apple Pay and Google Pay where supported. Your card details never touch KAYA's servers.",
      },
      {
        q: "Why is my total shown in a different currency than my card?",
        a: "Prices are stored in Ghanaian Cedis (GH₵). At checkout we convert to your sending currency (USD, GBP, CAD, EUR or AED) so you know exactly what your card will be charged.",
      },
      {
        q: "Is my payment information secure?",
        a: "Yes. KAYA uses Stripe, a PCI-DSS Level 1 certified processor. KAYA staff never see your full card number — only the last 4 digits on the receipt.",
      },
      {
        q: "Will I receive a receipt?",
        a: "Stripe emails a receipt as soon as the payment is captured, and the order page in-app keeps a full breakdown of items, delivery fees and totals.",
      },
    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    description: "Timing, tracking and recipient confirmation.",
    Icon: Truck,
    accent: "bg-charcoal-800 text-cream-50",
    faqs: [
      {
        q: "How long does delivery take?",
        a: "Provision and Mothercare orders typically arrive same-day in Accra and Tema. Gift orders honour your selected delivery date. Each shop's SLA shows on its destination card.",
      },
      {
        q: "How do I track an order?",
        a: "Open the order from the Orders tab — you'll see a six-step live timeline from 'Paid' through 'Delivered'. Push and in-app notifications fire on every milestone.",
      },
      {
        q: "What if my recipient isn't home?",
        a: "The vendor will call the recipient and reschedule for the same day. If we can't reach them, the order returns to the vendor and KAYA Ops will reach out to you with options.",
      },
      {
        q: "How does recipient confirmation work?",
        a: "After delivery we send the recipient an SMS / WhatsApp asking them to confirm receipt with one tap. You'll get a notification the moment they confirm — and if anything is wrong, the order is automatically flagged for KAYA Ops.",
      },
    ],
  },
  {
    id: "refunds",
    label: "Refunds",
    description: "Disputes, refunds and missed deliveries.",
    Icon: Receipt,
    accent: "bg-clay-100 text-clay-600",
    faqs: [
      {
        q: "How do I request a refund?",
        a: "Open the order, tap 'Need help?' and KAYA Operations will review within 24 hours. Eligible refunds are returned to your original payment method within 5–10 business days.",
      },
      {
        q: "What happens if my recipient reports a problem?",
        a: "The order is flagged for investigation immediately. KAYA Ops follows up with the recipient, the vendor and you — usually resolving with a replacement or refund.",
      },
      {
        q: "Can I cancel an order?",
        a: "Cancellations are free until the order moves to 'Being Prepared'. After that, chat with KAYA Ops and we'll do our best to recall the order before it leaves the vendor.",
      },
      {
        q: "Will I be charged for failed deliveries?",
        a: "No. If a vendor cannot deliver due to address or recipient issues we'll refund you in full and let you know exactly what happened.",
      },
    ],
  },
];

export default function Help() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <TopBar back title="Help Center" />
      <main className="container-app px-4 pb-12">
        <section className="card-base p-5 mb-5 bg-charcoal-800 text-cream-50 border-charcoal-700">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-12 h-12 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0">
              <HelpCircle size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-mustard-400 font-bold">
                KAYA help center
              </p>
              <h2 className="display text-xl sm:text-2xl font-semibold leading-tight">
                Find answers fast, or chat with us.
              </h2>
            </div>
          </div>
          <p className="text-sm text-cream-100/80 mt-3 leading-snug">
            We've gathered the most common questions about sending care to
            Accra and Tema. Tap a category to expand — and reach KAYA
            Operations any time something still feels unclear.
          </p>
        </section>

        <nav aria-label="FAQ categories" className="mb-5">
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            {CATEGORIES.map((c) => {
              const Icon = c.Icon;
              return (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white border border-charcoal-100 hover:border-charcoal-400 text-charcoal-800 px-3 py-1.5 text-xs font-semibold transition"
                >
                  <Icon size={13} /> {c.label}
                </a>
              );
            })}
          </div>
        </nav>

        {CATEGORIES.map((category) => {
          const Icon = category.Icon;
          return (
            <section
              key={category.id}
              id={category.id}
              className="mb-6 scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={cn(
                    "grid place-items-center w-10 h-10 rounded-2xl shrink-0",
                    category.accent
                  )}
                  aria-hidden
                >
                  <Icon size={16} />
                </span>
                <div>
                  <h3 className="display text-lg font-semibold leading-tight">
                    {category.label}
                  </h3>
                  <p className="text-xs text-charcoal-400">
                    {category.description}
                  </p>
                </div>
              </div>
              <div className="card-base divide-y divide-charcoal-100 overflow-hidden">
                {category.faqs.map((faq, i) => {
                  const id = `${category.id}_${i}`;
                  const isOpen = openId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : id)}
                      aria-expanded={isOpen}
                      className={cn(
                        "w-full text-left px-4 py-3.5 flex items-start gap-3 transition",
                        isOpen ? "bg-cream-100/60" : "hover:bg-cream-100"
                      )}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-charcoal-900 leading-snug">
                          {faq.q}
                        </span>
                        {isOpen && (
                          <span className="block text-sm text-charcoal-700 mt-2 leading-relaxed">
                            {faq.a}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "mt-0.5 text-charcoal-400 transition-transform shrink-0",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="card-base p-5 bg-mustard-100 border-mustard-400/40">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-charcoal-900 text-mustard-400 shrink-0">
              <HelpCircle size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="display text-lg font-semibold leading-tight">
                  Still need help?
                </p>
                <SupportStatusPill />
              </div>
              <p className="text-sm text-charcoal-700 mt-1 leading-snug">
                KAYA Operations is online during Ghana business hours and
                replies fast on email out-of-hours. We're the only people you
                need to talk to — no vendor or courier messaging required.
              </p>
              <div className="mt-3">
                <SupportButton variant="primary" label="Chat with KAYA Ops" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
