import { useRef, useState } from "react";
import { Upload, X, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  hint?: string;
  aspect?: "square" | "video" | "portrait" | "wide";
  className?: string;
  disabled?: boolean;
}

const ASPECT_CLASS: Record<NonNullable<ImageUploadProps["aspect"]>, string> = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  wide: "aspect-[21/9]",
};

const MAX_BYTES = 10 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/*  Client-side compression                                           */
/*                                                                    */
/*  Admins routinely drop 4\u201310 MB DSLR / phone-camera photos into    */
/*  the shop card and product-image slots. Even with CDN                 */
/*  transformation the original gets served the first time the URL    */
/*  is hit, so storing a slimmer copy directly cuts every downstream  */
/*  request \u2014 web, mobile, email receipts \u2014 in one shot.              */
/*                                                                    */
/*  We resize any dimension above 1600px, re-encode as WebP (falling  */
/*  back to JPEG when a browser can't emit WebP), and cap quality at  */
/*  0.82. If the compressed blob isn't meaningfully smaller than the  */
/*  original we discard it and upload the file the admin chose.       */
/* ------------------------------------------------------------------ */

const COMPRESS_MIN_BYTES = 200 * 1024; // Skip anything already tiny
const COMPRESS_MAX_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.82;

/**
 * Feature-detect the browser's ability to *encode* WebP via canvas.
 * Every browser we ship to (Chrome, Edge, Firefox, Safari 14+)
 * supports it \u2014 the check is defensive so we never write a WebP
 * blob that fails silently on an unusual client.
 */
function supportsWebP(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    if (!c.toDataURL) return false;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    const objectUrl = URL.createObjectURL(file);
    el.onload = () => resolve(el);
    el.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image failed to decode"));
    };
    el.src = objectUrl;
  });
}

/**
 * Return a resized + WebP-encoded copy of `file`, or `null` if
 * compression didn't reduce the payload (or the browser refused to
 * cooperate). The upload path uses `??` to fall back to the original
 * when this returns null, so the flow is failsafe.
 */
async function compressImage(file: File): Promise<File | null> {
  // Skip vector, animated and already-tiny files.
  if (file.type === "image/svg+xml" || file.type === "image/gif") return null;
  if (file.size < COMPRESS_MIN_BYTES) return null;

  const preferredType: "image/webp" | "image/jpeg" = supportsWebP()
    ? "image/webp"
    : "image/jpeg";

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return null;
  }

  try {
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > COMPRESS_MAX_DIMENSION || h > COMPRESS_MAX_DIMENSION) {
      const ratio = Math.min(
        COMPRESS_MAX_DIMENSION / w,
        COMPRESS_MAX_DIMENSION / h
      );
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // High-quality resample so downscaled photos don't look jagged.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, preferredType, COMPRESS_QUALITY);
    });

    if (!blob) return null;
    // Only ship the compressed copy if it's at least 5% smaller,
    // otherwise it's not worth re-encoding metadata + colour profile.
    if (blob.size >= file.size * 0.95) return null;

    const ext = preferredType === "image/webp" ? "webp" : "jpg";
    const nameNoExt = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${nameNoExt}.${ext}`, {
      type: preferredType,
      lastModified: Date.now(),
    });
  } finally {
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  }
}

export default function ImageUpload({
  value,
  onChange,
  bucket = "product-images",
  folder = "uploads",
  label,
  hint = "PNG, JPG or WebP · auto-compressed · up to 10 MB",
  aspect = "square",
  className,
  disabled,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("That's not an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be smaller than 10 MB.");
      return;
    }
    setUploading(true);
    try {
      // Try to compress client-side. Any failure (unsupported format,
      // out-of-memory canvas, weird DPI) silently falls back to the
      // original file so the admin never sees the upload fail.
      const optimised =
        (await compressImage(file).catch(() => null)) ?? file;

      const ext = (
        optimised.name.split(".").pop() || "jpg"
      ).toLowerCase();
      const path = `${folder}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, optimised, {
          // 1-year immutable cache. The URL is randomised per upload
          // so re-uploads produce a fresh URL and never poison the
          // long-lived cache.
          cacheControl: "31536000, immutable",
          upsert: false,
          contentType: optimised.type,
        });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(publicUrl);

      const savedKb = Math.max(
        0,
        Math.round((file.size - optimised.size) / 1024)
      );
      toast.success(
        savedKb > 30
          ? `Image uploaded · optimised (saved ${savedKb} KB)`
          : "Image uploaded"
      );
    } catch (err: any) {
      console.error("ImageUpload error:", err);
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const pickFile = (files: FileList | null | undefined) => {
    const file = files?.[0];
    if (file) upload(file);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="text-xs font-semibold text-charcoal-700 block mb-1.5">
          {label}
        </label>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-busy={uploading}
        aria-disabled={disabled || uploading}
        onClick={() => !uploading && !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !uploading) pickFile(e.dataTransfer.files);
        }}
        className={cn(
          "relative rounded-2xl overflow-hidden cursor-pointer transition group",
          "border-2 border-dashed",
          ASPECT_CLASS[aspect],
          dragOver
            ? "border-mustard-500 bg-mustard-100/40"
            : "border-charcoal-100 bg-cream-100",
          (disabled || uploading) && "opacity-70 cursor-wait"
        )}
      >
        {value ? (
          <>
            <img
              src={value}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-charcoal-900/0 group-hover:bg-charcoal-900/40 transition" />
            {!uploading && !disabled && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full bg-charcoal-900/80 text-cream-50 hover:bg-clay-500 transition opacity-90"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
                <div className="absolute inset-x-0 bottom-0 p-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-50 text-charcoal-900 text-xs font-semibold px-3 py-1.5 shadow-sm">
                    <ImagePlus size={13} /> Replace image
                  </span>
                </div>
              </>
            )}
            {uploading && (
              <div className="absolute inset-0 grid place-items-center bg-charcoal-900/60">
                <div className="flex flex-col items-center gap-2 text-cream-50">
                  <Loader2 className="animate-spin" size={22} />
                  <p className="text-[11px] font-semibold">Optimising…</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center px-4">
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-charcoal-700">
                <Loader2 className="animate-spin" />
                <p className="text-xs font-semibold">Optimising…</p>
                <p className="text-[10px] text-charcoal-400">
                  Compressing for fast mobile loading
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-charcoal-700">
                <span className="grid place-items-center w-11 h-11 rounded-full bg-mustard-400 text-charcoal-900 shadow-sm">
                  <Upload size={16} />
                </span>
                <p className="text-sm font-semibold">
                  Drop image or click to upload
                </p>
                {hint && <p className="text-[11px] text-charcoal-400">{hint}</p>}
              </div>
            )}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
