import {
  Building2,
  Facebook,
  Heart,
  Instagram,
  MessageCircle,
  MoreHorizontal,
  Music,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReferralSource } from "@/types";

/**
 * Ordered list of acquisition sources we ask new customers about. The
 * order is the order shown in the in-app prompt and the admin analytics
 * card — keep the most likely / friendly options near the top.
 */
export const REFERRAL_SOURCES: ReferralSource[] = [
  "Friend or Family",
  "WhatsApp Group",
  "Facebook",
  "Instagram",
  "TikTok",
  "Google Search",
  "Community Organization / Church",
  "Other",
];

export interface ReferralOptionConfig {
  /** Full label as defined in the spec. */
  label: string;
  /** Shorter label used in compact UI surfaces (chips, bars). */
  short: string;
  /** Lucide icon for the tile / bar marker. */
  Icon: LucideIcon;
  /** Background + foreground colours for the tile icon badge. */
  tile: string;
  /** Bar fill colour used in the analytics card. */
  bar: string;
}

export const REFERRAL_OPTIONS: Record<ReferralSource, ReferralOptionConfig> = {
  "Friend or Family": {
    label: "Friend or Family",
    short: "Friend or Family",
    Icon: Heart,
    tile: "bg-clay-100 text-clay-600",
    bar: "bg-clay-400",
  },
  "WhatsApp Group": {
    label: "WhatsApp Group",
    short: "WhatsApp",
    Icon: MessageCircle,
    tile: "bg-sage-100 text-sage-700",
    bar: "bg-sage-500",
  },
  Facebook: {
    label: "Facebook",
    short: "Facebook",
    Icon: Facebook,
    tile: "bg-cream-200 text-charcoal-800",
    bar: "bg-charcoal-700",
  },
  Instagram: {
    label: "Instagram",
    short: "Instagram",
    Icon: Instagram,
    tile: "bg-mustard-100 text-mustard-700",
    bar: "bg-mustard-500",
  },
  TikTok: {
    label: "TikTok",
    short: "TikTok",
    Icon: Music,
    tile: "bg-charcoal-100 text-charcoal-800",
    bar: "bg-charcoal-800",
  },
  "Google Search": {
    label: "Google Search",
    short: "Google",
    Icon: Search,
    tile: "bg-sage-100 text-sage-700",
    bar: "bg-sage-300",
  },
  "Community Organization / Church": {
    label: "Community Organization / Church",
    short: "Community / Church",
    Icon: Building2,
    tile: "bg-mustard-100 text-mustard-700",
    bar: "bg-mustard-400",
  },
  Other: {
    label: "Other",
    short: "Other",
    Icon: MoreHorizontal,
    tile: "bg-cream-100 text-charcoal-700",
    bar: "bg-charcoal-400",
  },
};

// ─── Refer-a-Friend credit system ──────────────────────────────────────
/** GH₵ credit awarded to the referrer when a referee places their first order. */
export const REFERRAL_CREDIT_GHS = 20;

/**
 * Generates a memorable 6-character referral code: 3 letters from the
 * user's name (uppercase, padded) + 3 random alphanumeric chars.
 * Examples — Kofi → KOFC4Q, Yaa → YAAX7B.
 */
export function generateReferralCode(seed: string): string {
  const cleaned = (seed ?? "").replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = (cleaned.slice(0, 3) || "KYA").padEnd(3, "X");
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}${suffix}`;
}

/** Normalises pasted referral codes — strips whitespace and uppercases. */
export function normalizeReferralCode(code: string): string {
  return (code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Lightweight format check — codes are 6 alphanumeric chars. */
export function isValidReferralCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(normalizeReferralCode(code));
}
