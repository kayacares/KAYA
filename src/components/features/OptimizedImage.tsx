import { useEffect, useMemo, useState } from "react";
import { optimizeFor, type ImageSizeToken } from "@/lib/imageOptim";

interface Props
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> {
  src: string;
  /** Surface the image is rendered on — picks a sensible target width. */
  size: ImageSizeToken;
  /**
   * Priority images (above-the-fold hero cards) bypass lazy loading
   * so they start downloading immediately. All other images stay
   * lazy so the initial paint isn't blocked by everything below the
   * fold.
   */
  priority?: boolean;
}

/**
 * Lightweight wrapper around `<img>` that adds every image
 * performance hint we can safely opt into:
 *
 *   - `loading="lazy"` for everything below the fold, `"eager"` for
 *     priority hero images.
 *   - `decoding="async"` so decoding never blocks the main thread.
 *   - `fetchpriority` hint so the browser prioritises the hero image
 *     over decorative ones.
 *   - CDN width-narrowing + WebP negotiation via `optimizeFor()` so
 *     Unsplash / Pexels / Supabase Storage each serve a phone-sized
 *     WebP instead of the full uploaded original.
 *   - Automatic fallback to the un-optimised URL if the transformed
 *     one 404s (e.g. Supabase Image Transformations aren't enabled).
 *   - A shimmering skeleton background painted on the img element
 *     itself while it downloads, then a soft 260ms fade-in when the
 *     bitmap decodes — so cards never look "broken" during load,
 *     even on slow mobile connections.
 */
export default function OptimizedImage({
  src,
  size,
  priority = false,
  onError,
  onLoad,
  className,
  ...rest
}: Props) {
  const optimised = useMemo(() => optimizeFor(src, size), [src, size]);
  const [currentSrc, setCurrentSrc] = useState(optimised);
  const [loaded, setLoaded] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  // If the caller swaps to a different src (product edit, admin
  // re-uploads image) reset the state so the new image can load.
  useEffect(() => {
    setCurrentSrc(optimised);
    setLoaded(false);
    setTriedFallback(false);
  }, [optimised]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    // Fall back to the un-optimised URL exactly once — covers the
    // case where the CDN transformation endpoint doesn't exist
    // (Supabase free tier) without ever leaving the user with a
    // broken image tile.
    if (!triedFallback && currentSrc !== src) {
      setTriedFallback(true);
      setCurrentSrc(src);
      return;
    }
    // Even a hard failure counts as "loaded" so the shimmer stops
    // pulsing forever behind a broken alt icon.
    setLoaded(true);
    onError?.(e);
  };

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    setLoaded(true);
    onLoad?.(e);
  };

  return (
    <img
      {...rest}
      src={currentSrc}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      // fetchpriority is a valid HTML attribute (Chromium 102+, Safari 17.2+)
      // but not yet in the React types; the lowercase attribute is what
      // the browser reads, so we spread it via a cast rather than adding
      // a project-wide type override.
      {...({ fetchpriority: priority ? "high" : "auto" } as Record<
        string,
        string
      >)}
      onError={handleError}
      onLoad={handleLoad}
      className={`${className ?? ""} ${
        loaded ? "kaya-img-loaded" : "kaya-img-loading"
      }`.trim()}
    />
  );
}
