import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      /**
       * KAYA palette — 2026 refresh
       * ---------------------------
       *  mustard  →  the brand color. Shifted from a muted #F2C94C to a
       *              deeper, more saturated amber so primary CTAs, chips
       *              and hero moments feel warm, confident and premium
       *              rather than washed-out. Every existing `bg-mustard-*`
       *              usage inherits the richer tone automatically.
       *
       *  emerald  →  NEW complementary accent. Reserved for success states,
       *              delivery tracking, "out for delivery" / "delivered"
       *              badges, positive confirmations and the fresh-food
       *              feel of "care in motion". Rich enough to pair boldly
       *              with the new mustard without competing.
       *
       *  sage     →  Kept for softer informational surfaces (delivery
       *              notice cards, background chips) where emerald would
       *              feel too loud.
       *
       *  charcoal →  Unchanged — remains the ink for body copy, secondary
       *              buttons and dark-mode surfaces.
       */
      colors: {
        cream: {
          50: "#FBF7EE",
          100: "#F7F0DD",
          200: "#EFE3C0",
        },
        mustard: {
          50: "#FEF9E7",
          100: "#FCEFB4",
          200: "#F9E27F",
          300: "#F5D047",
          400: "#EBB014",
          500: "#CE9410",
          600: "#A0740D",
          700: "#7A580A",
        },
        emerald: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#10B981",
          500: "#059669",
          600: "#047857",
          700: "#065F46",
          800: "#064E3B",
        },
        charcoal: {
          50: "#F4F4F3",
          100: "#E5E5E3",
          400: "#5A5A57",
          700: "#262624",
          800: "#1A1A18",
          900: "#0F0F0E",
        },
        sage: {
          100: "#E4EDDF",
          300: "#A9C39A",
          500: "#74955F",
          700: "#4F6A3F",
        },
        clay: {
          400: "#C97B5D",
          600: "#A85838",
        },
        background: "#FBF7EE",
        foreground: "#1A1A18",
      },
      borderRadius: {
        xl2: "1.25rem",
        "3xl": "1.75rem",
      },
      /**
       * Elevation scale — 2026 refresh
       * ------------------------------
       *  soft   →  Baseline lift for resting cards. Slightly cooler
       *            offset so cards feel like they float on paper.
       *  card   →  Hover / focused state for interactive tiles.
       *  hi     →  Modal + hero elevation.
       *  cta    →  Amber glow beneath primary CTA buttons — makes them
       *            feel physically pushed forward from the surface
       *            without adding visual clutter.
       *  emerald→  Green glow beneath confirmation CTAs and the
       *            delivery-tracking button.
       *  lift   →  Larger hover elevation for photo cards so imagery
       *            responds tangibly to touch.
       */
      boxShadow: {
        soft: "0 6px 20px -10px rgba(26,26,24,0.14), 0 2px 6px -2px rgba(26,26,24,0.06)",
        card: "0 14px 40px -14px rgba(26,26,24,0.22), 0 4px 12px -4px rgba(26,26,24,0.08)",
        hi: "0 24px 60px -20px rgba(26,26,24,0.4)",
        cta: "0 10px 26px -8px rgba(235,176,20,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
        "cta-hover": "0 16px 34px -8px rgba(235,176,20,0.65), inset 0 1px 0 rgba(255,255,255,0.5)",
        emerald: "0 10px 26px -8px rgba(5,150,105,0.5), inset 0 1px 0 rgba(255,255,255,0.28)",
        lift: "0 24px 44px -20px rgba(26,26,24,0.3), 0 8px 20px -8px rgba(26,26,24,0.12)",
      },
      letterSpacing: {
        eyebrow: "0.14em",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.4s ease-out both",
        "scale-in": "scale-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
