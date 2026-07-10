/**
 * Image URL optimisation helpers.
 * -----------------------------------------------------------------
 * Every product / shop / care-package tile on KAYA renders an <img>
 * with `loading="lazy"` + `decoding="async"`. That takes care of
 * browser-side rendering, but the *bytes on the wire* still matter:
 * an admin-uploaded 4 MB DSLR photo will crawl on a phone regardless
 * of decoding strategy.
 *
 * `optimizeImageUrl` narrows the fetched size for URLs whose CDN we
 * know accepts a `?w=` (or equivalent) parameter — Unsplash, Pexels
 * and Supabase Storage's Image Transformation endpoint — and where
 * possible flips the response to WebP so the wire payload is 25–35%
 * smaller than the equivalent JPEG. Unknown hosts pass through
 * untouched so nothing is ever *broken* — only made faster when we
 * can prove it's safe.
 *
 * `IMAGE_SIZES` gives every call site one place to pick a sensible
 * target width for the surface it renders on. Bumps to hero images
 * or thumbnail sizes only need to happen here.
 *
 * Every token is roughly 2× the largest rendered CSS width so retina
 * mobile screens still render crisply while the bytes on the wire
 * stay well under 100 KB per tile.
 */

export const IMAGE_SIZES = {
  // Product tile in the shop grid (aspect-square, ~180px on mobile).
  productCard: 480,
  // Small product thumbnail (cart line item, order detail, ~56–80px).
  productThumb: 240,
  // Cover on a care-package tile in the home grid (aspect 4:5, ~200px).
  carePackageCard: 560,
  // Shop hero card on the home grid (aspect 4:3, ~300–360px).
  shopCard: 720,
  // Larger surfaces: product sheet, detail hero, login hero.
  hero: 1024,
} as const;

export type ImageSizeToken = keyof typeof IMAGE_SIZES;

interface OptimizeOptions {
  width?: number;
  quality?: number;
}

const SUPABASE_PUBLIC_MARKER = "/storage/v1/object/public/";
const SUPABASE_RENDER_MARKER = "/storage/v1/render/image/public/";

/**
 * Return a size-narrowed URL for hosts we know about. Unknown hosts
 * pass through unchanged.
 */
export function optimizeImageUrl(
  url: string | undefined | null,
  { width = IMAGE_SIZES.productCard, quality = 75 }: OptimizeOptions = {}
): string {
  if (!url) return "";
  // Skip anything that isn't an http(s) resource — data:, blob:,
  // object URLs from a File preview all render fine as-is.
  if (!/^https?:\/\//i.test(url)) return url;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Unsplash — supports w= and auto=compress out of the box on
    // every plan; setting them shrinks a 4 MB shot down to ~40 KB.
    // We also opt in to fm=webp so the response is served as WebP
    // (~30% smaller than JPEG at the same visual quality) whenever
    // the browser accepts it.
    if (host.endsWith("images.unsplash.com")) {
      parsed.searchParams.set("w", String(width));
      parsed.searchParams.set("q", String(quality));
      if (!parsed.searchParams.has("auto")) {
        parsed.searchParams.set("auto", "compress,format");
      }
      if (!parsed.searchParams.has("fit")) {
        parsed.searchParams.set("fit", "crop");
      }
      if (!parsed.searchParams.has("fm")) {
        parsed.searchParams.set("fm", "webp");
      }
      return parsed.toString();
    }

    // Pexels — auto=compress + w= behave the same way. If the caller
    // already fixed a width we keep theirs.
    if (host.endsWith("images.pexels.com")) {
      if (!parsed.searchParams.has("w")) {
        parsed.searchParams.set("w", String(width));
      }
      if (!parsed.searchParams.has("auto")) {
        parsed.searchParams.set("auto", "compress");
      }
      if (!parsed.searchParams.has("cs")) {
        parsed.searchParams.set("cs", "tinysrgb");
      }
      return parsed.toString();
    }

    // Supabase Storage — swap the plain-object endpoint for the
    // Image Transformation endpoint. `format=webp` cuts payload size
    // dramatically vs the uploaded JPEG/PNG. This is a no-op on
    // projects without transformations enabled (the URL just 404s
    // and the <img>'s onError handler in OptimizedImage falls back
    // to the original), so we can opt in for every image bucket
    // without risk.
    if (parsed.pathname.includes(SUPABASE_PUBLIC_MARKER)) {
      const rendered = url.replace(
        SUPABASE_PUBLIC_MARKER,
        SUPABASE_RENDER_MARKER
      );
      const separator = rendered.includes("?") ? "&" : "?";
      return `${rendered}${separator}width=${width}&quality=${quality}&resize=cover&format=webp`;
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * Convenience wrapper: pick a target width by surface token so
 * consumers never have to guess a pixel count.
 */
export function optimizeFor(
  url: string | undefined | null,
  token: ImageSizeToken,
  quality = 75
): string {
  return optimizeImageUrl(url, { width: IMAGE_SIZES[token], quality });
}
