import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderUp,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { Product, ProductAvailability, Shop, Vendor } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { uid } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import ImageUpload from "@/components/features/ImageUpload";
import {
  confidenceBand,
  fileKey,
  imageSimilarity,
  normalizeImageString,
} from "@/lib/imageMatch";

interface ImportRow {
  rowNumber: number;
  product: Product;
  imageFilename?: string;
}
interface ImportError {
  rowNumber: number;
  messages: string[];
}

type MatchType =
  | "exact_filename"
  | "exact_normalized"
  | "ai_suggestion"
  | "unmatched";
type MatchDecision = "pending" | "accepted" | "rejected";
type UploadState = "idle" | "uploading" | "uploaded" | "failed";

interface ImageMatch {
  fileId: string;
  file: File;
  productId: string | null;
  productName: string | null;
  confidence: number;
  matchType: MatchType;
  decision: MatchDecision;
  uploadState: UploadState;
  imageUrl?: string;
  errorMessage?: string;
}

type Step = "idle" | "review" | "images" | "summary";

const TEMPLATE_HEADERS = [
  "Product Name",
  "Brand",
  "Category",
  "Shop",
  "Description",
  "Size / Variant",
  "Wholesale Price (GHS)",
  "Selling Price (GHS)",
  "Vendor",
  "Product Status",
  "Delivery Class",
  "SKU",
  "Image Filename",
];

const STATUS_MAP: Record<string, ProductAvailability> = {
  active: "active",
  available: "active",
  on: "active",
  yes: "active",
  temporarily_unavailable: "temporarily_unavailable",
  "temporarily unavailable": "temporarily_unavailable",
  unavailable: "temporarily_unavailable",
  paused: "temporarily_unavailable",
  inactive: "inactive",
  off: "inactive",
  hidden: "inactive",
  draft: "inactive",
};

const AI_SUGGESTION_THRESHOLD = 0.4;

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase() === k.toLowerCase()
    );
    if (
      found &&
      row[found] !== undefined &&
      row[found] !== null &&
      row[found] !== ""
    ) {
      return String(row[found]).trim();
    }
  }
  return "";
}

function validateRow(
  row: Record<string, unknown>,
  rowNumber: number,
  shops: Shop[],
  vendors: Vendor[]
): { ok: true; row: ImportRow } | { ok: false; error: ImportError } {
  const messages: string[] = [];

  const name = pick(row, ["Product Name", "Name"]);
  if (!name) messages.push("Product Name is required");

  const shopName = pick(row, ["Shop"]);
  const shop = shopName
    ? shops.find((s) => s.name.toLowerCase() === shopName.toLowerCase())
    : null;
  if (!shopName) messages.push("Shop is required");
  else if (!shop)
    messages.push(
      `Shop "${shopName}" not found (expected one of: ${shops
        .map((s) => s.name)
        .join(" | ")})`
    );

  // Vendor cell can list multiple vendors separated by commas or pipes
  // (e.g. "Accra Wholesaler, Tema Wholesaler") so the same product can
  // be sourced from more than one supplier. Each name must match an
  // existing vendor or the row fails validation.
  const vendorRaw = pick(row, ["Vendor", "Vendors"]);
  const vendorNames = vendorRaw
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const resolvedVendors: Vendor[] = [];
  const missingVendors: string[] = [];
  for (const vn of vendorNames) {
    const found = vendors.find(
      (v) => v.name.toLowerCase() === vn.toLowerCase()
    );
    if (found) resolvedVendors.push(found);
    else missingVendors.push(vn);
  }
  if (vendorNames.length === 0) messages.push("Vendor is required");
  else if (missingVendors.length > 0)
    messages.push(
      `Vendor${missingVendors.length === 1 ? "" : "s"} not found: ${missingVendors.join(
        ", "
      )}`
    );

  const wholesaleStr = pick(row, [
    "Wholesale Price (GHS)",
    "Wholesale Price",
    "Wholesale",
    "Cost",
  ]);
  const wholesale = Number(wholesaleStr);
  if (!wholesaleStr) messages.push("Wholesale Price is required");
  else if (!Number.isFinite(wholesale) || wholesale < 0)
    messages.push(
      `Wholesale Price must be a positive number (got "${wholesaleStr}")`
    );

  const sellingStr = pick(row, [
    "Selling Price (GHS)",
    "Selling Price",
    "Price",
  ]);
  const selling = Number(sellingStr);
  if (!sellingStr) messages.push("Selling Price is required");
  else if (!Number.isFinite(selling) || selling < 0)
    messages.push(
      `Selling Price must be a positive number (got "${sellingStr}")`
    );

  if (
    Number.isFinite(wholesale) &&
    Number.isFinite(selling) &&
    selling < wholesale
  ) {
    messages.push(
      `Selling Price (${selling}) is below Wholesale Price (${wholesale})`
    );
  }

  const statusRaw = pick(row, ["Product Status", "Status"]).toLowerCase();
  const status: ProductAvailability =
    STATUS_MAP[statusRaw] ?? (statusRaw === "" ? "active" : "active");

  if (messages.length > 0 || !shop || resolvedVendors.length === 0) {
    return { ok: false, error: { rowNumber, messages } };
  }

  const product: Product = {
    id: uid("p"),
    name,
    shopId: shop.id,
    vendorId: resolvedVendors[0].id,
    vendorIds: resolvedVendors.map((v) => v.id),
    vendorCost: wholesale,
    sellingPrice: selling,
    unit: pick(row, ["Size / Variant", "Size", "Variant", "Unit"]) || "",
    category: pick(row, ["Category"]) || "",
    image: "",
    active: status === "active",
    availability: status,
    description: pick(row, ["Description"]) || undefined,
    brand: pick(row, ["Brand"]) || undefined,
    sku: pick(row, ["SKU"]) || undefined,
    deliveryClass: pick(row, ["Delivery Class"]) || undefined,
  };

  const imageFilename =
    pick(row, ["Image Filename", "Image", "Image File"]) || undefined;
  return { ok: true, row: { rowNumber, product, imageFilename } };
}

/**
 * Build an upload path scoped to the catalog folder. Names are
 * namespaced with a timestamp + random suffix to avoid collisions
 * when admins re-import the same filenames repeatedly.
 */
function buildStoragePath(file: File): string {
  const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "_");
  return `catalog/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}`;
}

async function uploadImageToStorage(file: File): Promise<string> {
  const path = buildStoragePath(file);
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

export default function ProductImportModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { shops, vendors, upsertProduct } = useApp();
  const [step, setStep] = useState<Step>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [validRows, setValidRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [imported, setImported] = useState<ImportRow[]>([]);
  const [matches, setMatches] = useState<ImageMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const seenKeysRef = useRef<Set<string>>(new Set());

  const handleDownloadTemplate = async () => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const sampleRows: (string | number)[][] = [
        TEMPLATE_HEADERS,
        [
          "Royal Aroma Rice",
          "Royal Aroma",
          "Grains",
          shops[0]?.name ?? "The Provision Shop",
          "Premium long grain rice — perfect for jollof",
          "5kg bag",
          95,
          135,
          vendors[0]?.name ?? "Accra Wholesaler",
          "active",
          "standard",
          "PROV-RICE-5KG",
          "rice.jpg",
        ],
        [
          "Pampers Premium Diapers",
          "Pampers",
          "Diapers",
          shops.find((s) => s.id === "mothercare")?.name ?? "Mothercare",
          "Ultra-soft, size 4",
          "60 pcs",
          110,
          165,
          vendors[0]?.name ?? "Accra Wholesaler",
          "active",
          "standard",
          "MOTH-DIAP-S4-60",
          "diapers.jpg",
        ],
      ];
      const ws = XLSX.utils.aoa_to_sheet(sampleRows);
      ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");

      const instructions = [
        ["Field", "Required", "Notes"],
        [
          "Product Name",
          "Yes",
          "Display name on the customer-facing product card",
        ],
        ["Brand", "No", "Manufacturer or label (e.g. Pampers, Philips)"],
        ["Category", "No", "Free-text category, e.g. Grains, Diapers"],
        [
          "Shop",
          "Yes",
          `Must match: ${shops.map((s) => s.name).join(" | ")}`,
        ],
        ["Description", "No", "Short description shown on detail view"],
        [
          "Size / Variant",
          "No",
          "Pack size / variant (e.g. 5kg bag, 60 pcs)",
        ],
        ["Wholesale Price (GHS)", "Yes", "Cost from vendor in Ghana cedis"],
        ["Selling Price (GHS)", "Yes", "Customer-facing price in Ghana cedis"],
        [
          "Vendor",
          "Yes",
          `Vendor name(s) — separate multiple with commas if more than one vendor stocks the product. Must match: ${vendors
            .map((v) => v.name)
            .join(" | ")}`,
        ],
        [
          "Product Status",
          "No",
          "active | temporarily_unavailable | inactive  (defaults to active)",
        ],
        [
          "Delivery Class",
          "No",
          "Free-text routing class — e.g. standard, bulky, cold-chain",
        ],
        ["SKU", "No", "Internal stock-keeping unit identifier"],
        [
          "Image Filename",
          "No",
          "Reference for matching uploaded images after import — exact filename match is auto-applied",
        ],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(instructions);
      ws2["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Instructions");

      XLSX.writeFile(wb, "kaya-product-template.xlsx");
      toast.success("Template downloaded");
    } catch (e) {
      toast.error(
        `Could not generate template: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab);
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase() === "products") ??
        wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      if (!sheet) throw new Error("No sheet found in workbook");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const valids: ImportRow[] = [];
      const errs: ImportError[] = [];
      raw.forEach((row, idx) => {
        if (Object.values(row).every((v) => String(v ?? "").trim() === ""))
          return;
        const result = validateRow(row, idx + 2, shops, vendors);
        if (result.ok) valids.push(result.row);
        else errs.push(result.error);
      });
      setValidRows(valids);
      setErrors(errs);
      setStep("review");
      if (valids.length === 0 && errs.length === 0) {
        toast.error("No rows found in the file.");
      }
    } catch (e) {
      toast.error(
        `Could not parse file: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImport = () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }
    setBusy(true);
    for (const row of validRows) upsertProduct(row.product);
    setImported(validRows);
    setStep("images");
    setBusy(false);
    seenKeysRef.current = new Set();
    toast.success(
      `Imported ${validRows.length} product${
        validRows.length === 1 ? "" : "s"
      }`
    );
  };

  /**
   * Run the 4-tier match pipeline against the imported product list,
   * skipping any files already added in a previous drop event.
   */
  const handleImagesAdded = (incoming: File[]) => {
    const fresh = incoming.filter((f) => {
      if (!f.type.startsWith("image/")) return false;
      const key = fileKey(f);
      if (seenKeysRef.current.has(key)) return false;
      seenKeysRef.current.add(key);
      return true;
    });
    if (fresh.length === 0) return;

    // Snapshot of products already reserved by an accepted/auto match.
    const reserved = new Set<string>(
      matches
        .filter(
          (m) =>
            m.productId &&
            (m.decision === "accepted" ||
              m.matchType === "exact_filename" ||
              m.matchType === "exact_normalized")
        )
        .map((m) => m.productId as string)
    );
    const newMatches: ImageMatch[] = [];

    // Phase 1: exact filename match against Excel "Image Filename"
    for (const file of fresh) {
      const row = imported.find(
        (r) =>
          r.imageFilename &&
          r.imageFilename.toLowerCase().trim() ===
            file.name.toLowerCase().trim() &&
          !reserved.has(r.product.id)
      );
      if (row) {
        reserved.add(row.product.id);
        newMatches.push({
          fileId: uid("img"),
          file,
          productId: row.product.id,
          productName: row.product.name,
          confidence: 1,
          matchType: "exact_filename",
          decision: "accepted",
          uploadState: "idle",
        });
      }
    }

    // Phase 2: normalised exact match against product names
    for (const file of fresh) {
      if (newMatches.some((m) => m.file === file)) continue;
      const fNorm = normalizeImageString(file.name);
      const row = imported.find(
        (r) =>
          normalizeImageString(r.product.name) === fNorm &&
          !reserved.has(r.product.id)
      );
      if (row) {
        reserved.add(row.product.id);
        newMatches.push({
          fileId: uid("img"),
          file,
          productId: row.product.id,
          productName: row.product.name,
          confidence: 0.95,
          matchType: "exact_normalized",
          decision: "accepted",
          uploadState: "idle",
        });
      }
    }

    // Phase 3 + 4: AI suggestion or unmatched
    for (const file of fresh) {
      if (newMatches.some((m) => m.file === file)) continue;
      const candidates = imported
        .filter((r) => !reserved.has(r.product.id))
        .map((r) => ({
          row: r,
          score: imageSimilarity(file.name, r.product.name),
        }))
        .sort((a, b) => b.score - a.score);

      const best = candidates[0];
      if (best && best.score >= AI_SUGGESTION_THRESHOLD) {
        newMatches.push({
          fileId: uid("img"),
          file,
          productId: best.row.product.id,
          productName: best.row.product.name,
          confidence: best.score,
          matchType: "ai_suggestion",
          decision: "pending",
          uploadState: "idle",
        });
      } else {
        newMatches.push({
          fileId: uid("img"),
          file,
          productId: null,
          productName: null,
          confidence: 0,
          matchType: "unmatched",
          decision: "pending",
          uploadState: "idle",
        });
      }
    }

    setMatches((prev) => [...prev, ...newMatches]);
    const auto = newMatches.filter(
      (m) =>
        m.matchType === "exact_filename" || m.matchType === "exact_normalized"
    ).length;
    const ai = newMatches.filter((m) => m.matchType === "ai_suggestion").length;
    const none = newMatches.filter((m) => m.matchType === "unmatched").length;
    toast.success(
      `${newMatches.length} added · ${auto} auto · ${ai} AI · ${none} unmatched`
    );
  };

  const acceptMatch = (id: string) =>
    setMatches((prev) => {
      const target = prev.find((m) => m.fileId === id);
      if (!target?.productId) return prev;
      // Guard against double-assigning a product
      const conflict = prev.find(
        (m) =>
          m.fileId !== id &&
          m.productId === target.productId &&
          m.decision === "accepted"
      );
      if (conflict) {
        toast.error(
          `${target.productName} is already paired with ${conflict.file.name}. Reject that first.`
        );
        return prev;
      }
      return prev.map((m) =>
        m.fileId === id ? { ...m, decision: "accepted" } : m
      );
    });

  const rejectMatch = (id: string) =>
    setMatches((prev) =>
      prev.map((m) =>
        m.fileId === id
          ? {
              ...m,
              decision: "rejected",
              matchType: m.matchType === "ai_suggestion" ? "unmatched" : m.matchType,
              productId: null,
              productName: null,
              confidence: 0,
            }
          : m
      )
    );

  const assignManually = (id: string, productId: string) =>
    setMatches((prev) => {
      const target = prev.find((m) => m.fileId === id);
      if (!target) return prev;
      const product = imported.find((r) => r.product.id === productId)?.product;
      if (!product) return prev;
      const conflict = prev.find(
        (m) =>
          m.fileId !== id &&
          m.productId === productId &&
          m.decision === "accepted"
      );
      if (conflict) {
        toast.error(
          `${product.name} is already paired with ${conflict.file.name}.`
        );
        return prev;
      }
      return prev.map((m) =>
        m.fileId === id
          ? {
              ...m,
              productId,
              productName: product.name,
              confidence: 1,
              matchType: "ai_suggestion",
              decision: "accepted",
            }
          : m
      );
    });

  const removeMatch = (id: string) =>
    setMatches((prev) => {
      const target = prev.find((m) => m.fileId === id);
      if (target) seenKeysRef.current.delete(fileKey(target.file));
      return prev.filter((m) => m.fileId !== id);
    });

  const acceptedToUpload = useMemo(
    () =>
      matches.filter(
        (m) =>
          m.decision === "accepted" &&
          m.productId &&
          m.uploadState !== "uploaded"
      ),
    [matches]
  );

  const applyMatches = async () => {
    if (acceptedToUpload.length === 0) {
      toast.message("No matches to apply yet — accept some suggestions or skip.");
      setStep("summary");
      return;
    }
    setBusy(true);
    let successCount = 0;
    let failCount = 0;
    for (const match of acceptedToUpload) {
      setMatches((prev) =>
        prev.map((m) =>
          m.fileId === match.fileId ? { ...m, uploadState: "uploading" } : m
        )
      );
      try {
        const publicUrl = await uploadImageToStorage(match.file);
        const productRow = imported.find(
          (r) => r.product.id === match.productId
        );
        if (productRow) {
          const updated: Product = { ...productRow.product, image: publicUrl };
          upsertProduct(updated);
          setImported((prev) =>
            prev.map((r) =>
              r.product.id === updated.id ? { ...r, product: updated } : r
            )
          );
        }
        setMatches((prev) =>
          prev.map((m) =>
            m.fileId === match.fileId
              ? { ...m, uploadState: "uploaded", imageUrl: publicUrl }
              : m
          )
        );
        successCount += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setMatches((prev) =>
          prev.map((m) =>
            m.fileId === match.fileId
              ? { ...m, uploadState: "failed", errorMessage: msg }
              : m
          )
        );
        failCount += 1;
      }
    }
    setBusy(false);
    if (successCount > 0)
      toast.success(
        `Uploaded ${successCount} image${successCount === 1 ? "" : "s"}`
      );
    if (failCount > 0)
      toast.error(`${failCount} upload${failCount === 1 ? "" : "s"} failed.`);
    setStep("summary");
  };

  const handleImageUpdate = (productId: string, url: string) => {
    const productRow = imported.find((r) => r.product.id === productId);
    if (productRow) {
      const updated: Product = { ...productRow.product, image: url };
      upsertProduct(updated);
      setImported((prev) =>
        prev.map((r) =>
          r.product.id === productId ? { ...r, product: updated } : r
        )
      );
    }
  };

  const missingProducts = useMemo(
    () => imported.filter((r) => !r.product.image),
    [imported]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-charcoal-900/60"
        onClick={onClose}
      />
      <div className="relative bg-cream-50 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-full bg-charcoal-100 hover:bg-charcoal-200 text-charcoal-700 z-10"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3 mb-5 pr-9">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-mustard-400 text-charcoal-900 shrink-0">
            <FileSpreadsheet size={20} />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700">
              Bulk import
            </p>
            <h3 className="display text-xl font-semibold leading-tight">
              Import products from Excel
            </h3>
            <p className="text-xs text-charcoal-400 mt-1 leading-snug">
              {step === "idle" &&
                "Upload an .xlsx file with one product per row. Every row is validated before anything is imported."}
              {step === "review" &&
                "Review parsed rows and any validation errors before importing."}
              {step === "images" &&
                "Drop in your product images. KAYA smart-matches by filename then by AI-style similarity."}
              {step === "summary" &&
                "Import complete. Fill any remaining gaps below."}
            </p>
          </div>
        </div>

        <StepIndicator step={step} />

        {step === "idle" && (
          <IdleView
            onDownload={handleDownloadTemplate}
            onFile={handleFile}
            busy={busy}
          />
        )}

        {step === "review" && (
          <ReviewView
            fileName={fileName}
            validRows={validRows}
            errors={errors}
            shops={shops}
            onCancel={() => {
              setStep("idle");
              setValidRows([]);
              setErrors([]);
              setFileName("");
            }}
            onImport={handleImport}
            busy={busy}
          />
        )}

        {step === "images" && (
          <ImagesView
            imported={imported}
            matches={matches}
            shops={shops}
            busy={busy}
            onAddImages={handleImagesAdded}
            onAccept={acceptMatch}
            onReject={rejectMatch}
            onAssign={assignManually}
            onRemove={removeMatch}
            onApply={applyMatches}
            onSkip={() => setStep("summary")}
          />
        )}

        {step === "summary" && (
          <SummaryView
            imported={imported}
            matches={matches}
            missingProducts={missingProducts}
            shops={shops}
            onImageUpdate={handleImageUpdate}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "idle", label: "Upload" },
    { id: "review", label: "Review" },
    { id: "images", label: "Images" },
    { id: "summary", label: "Summary" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === step);
  return (
    <div className="mb-5 flex items-center gap-1.5">
      {steps.map((s, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <div key={s.id} className="flex items-center gap-1.5 flex-1">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                isActive
                  ? "bg-charcoal-900 text-cream-50"
                  : isDone
                  ? "bg-sage-300 text-charcoal-900"
                  : "bg-cream-100 text-charcoal-400"
              }`}
            >
              <span>{i + 1}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 rounded-full ${
                  isDone ? "bg-sage-300" : "bg-cream-100"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function IdleView({
  onDownload,
  onFile,
  busy,
}: {
  onDownload: () => void;
  onFile: (file: File) => void;
  busy: boolean;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-4">
      <div className="card-base p-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-cream-100 shrink-0">
            <Download size={16} className="text-charcoal-700" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              Step 1 — Download the template
            </p>
            <p className="text-xs text-charcoal-400 mt-0.5 leading-snug">
              Two-tab .xlsx with the right columns, two example rows and an
              instructions sheet.
            </p>
          </div>
          <button
            onClick={onDownload}
            disabled={busy}
            className="btn-outline text-xs disabled:opacity-50 shrink-0"
          >
            <Download size={12} /> Template
          </button>
        </div>
      </div>

      <label
        htmlFor="kaya-xlsx-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`block cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition ${
          drag
            ? "border-charcoal-800 bg-cream-100"
            : "border-charcoal-100 bg-white hover:border-charcoal-400"
        }`}
      >
        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-mustard-400 text-charcoal-900 mx-auto mb-3">
          <Upload size={20} />
        </span>
        <p className="font-semibold text-base">
          Step 2 — Drop your .xlsx here
        </p>
        <p className="text-xs text-charcoal-400 mt-1">
          or tap to choose a file — only .xlsx supported.
        </p>
        <input
          id="kaya-xlsx-input"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>

      <div className="rounded-2xl bg-cream-100 border border-charcoal-100/60 p-3 text-[11px] text-charcoal-700 leading-relaxed">
        <span className="font-semibold text-charcoal-900">CSV later:</span> CSV
        support is on the roadmap. For now please use .xlsx — it preserves
        prices, formulas and product-status enums without ambiguity.
      </div>
    </div>
  );
}

function ReviewView({
  fileName,
  validRows,
  errors,
  shops,
  onCancel,
  onImport,
  busy,
}: {
  fileName: string;
  validRows: ImportRow[];
  errors: ImportError[];
  shops: Shop[];
  onCancel: () => void;
  onImport: () => void;
  busy: boolean;
}) {
  const total = validRows.length + errors.length;
  return (
    <div className="space-y-4">
      <div className="card-base p-4">
        <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
          Reviewing
        </p>
        <p className="font-semibold text-sm truncate">{fileName}</p>
        <p className="text-xs text-charcoal-400 mt-1">
          {total} row{total === 1 ? "" : "s"} found · {validRows.length} valid ·{" "}
          {errors.length} with errors
        </p>
      </div>

      {errors.length > 0 && (
        <div className="card-base border-clay-400/40 bg-clay-400/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-clay-600" />
            <p className="font-semibold text-sm text-clay-600">
              {errors.length} row{errors.length === 1 ? "" : "s"} need attention
            </p>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {errors.map((err) => (
              <div key={err.rowNumber} className="text-xs">
                <p className="font-semibold text-clay-600">
                  Row {err.rowNumber}
                </p>
                <ul className="ml-3 list-disc text-charcoal-700">
                  {err.messages.map((m, i) => (
                    <li key={i} className="leading-snug">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-charcoal-400 mt-2 leading-snug">
            Fix these rows in your Excel file and re-upload. Valid rows can
            still be imported below.
          </p>
        </div>
      )}

      {validRows.length > 0 && (
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-sage-700" />
            <p className="font-semibold text-sm">
              {validRows.length} product{validRows.length === 1 ? "" : "s"}{" "}
              ready to import
            </p>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {validRows.slice(0, 20).map((r) => {
              const shop = shops.find((s) => s.id === r.product.shopId);
              return (
                <div
                  key={r.rowNumber}
                  className="text-xs flex items-center gap-2"
                >
                  <span className="chip bg-cream-100 text-charcoal-700 text-[10px] shrink-0">
                    Row {r.rowNumber}
                  </span>
                  <span className="font-semibold truncate">
                    {r.product.name}
                  </span>
                  <span className="text-charcoal-400 shrink-0">
                    · {shop?.emoji} {shop?.name}
                  </span>
                </div>
              );
            })}
            {validRows.length > 20 && (
              <p className="text-[10px] text-charcoal-400 italic">
                …and {validRows.length - 20} more
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 sticky bottom-0 bg-cream-50 pt-3">
        <button
          onClick={onImport}
          disabled={busy || validRows.length === 0}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {busy ? "Importing…" : `Import ${validRows.length} valid`}
        </button>
        <button onClick={onCancel} disabled={busy} className="btn-outline">
          Re-upload
        </button>
      </div>
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const band = confidenceBand(confidence);
  const className =
    band === "high"
      ? "bg-sage-100 text-sage-700"
      : band === "medium"
      ? "bg-mustard-100 text-mustard-700"
      : band === "low"
      ? "bg-clay-400/15 text-clay-600"
      : "bg-charcoal-100 text-charcoal-400";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${className}`}
    >
      <Sparkles size={9} />
      {Math.round(confidence * 100)}%
    </span>
  );
}

function ImagesView({
  imported,
  matches,
  shops,
  busy,
  onAddImages,
  onAccept,
  onReject,
  onAssign,
  onRemove,
  onApply,
  onSkip,
}: {
  imported: ImportRow[];
  matches: ImageMatch[];
  shops: Shop[];
  busy: boolean;
  onAddImages: (files: File[]) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAssign: (id: string, productId: string) => void;
  onRemove: (id: string) => void;
  onApply: () => void;
  onSkip: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const autoMatches = matches.filter(
    (m) =>
      (m.matchType === "exact_filename" ||
        m.matchType === "exact_normalized") &&
      m.decision === "accepted"
  );
  const aiPending = matches.filter(
    (m) => m.matchType === "ai_suggestion" && m.decision === "pending"
  );
  const aiAccepted = matches.filter(
    (m) => m.matchType === "ai_suggestion" && m.decision === "accepted"
  );
  const unmatched = matches.filter(
    (m) => m.matchType === "unmatched" || m.decision === "rejected"
  );

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    onAddImages(Array.from(list));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-3xl border-2 border-dashed p-6 text-center transition ${
          drag
            ? "border-charcoal-800 bg-cream-100"
            : "border-charcoal-100 bg-white"
        }`}
      >
        <span className="grid place-items-center w-12 h-12 rounded-2xl bg-mustard-400 text-charcoal-900 mx-auto mb-2">
          <Sparkles size={18} />
        </span>
        <p className="font-semibold text-sm">
          Drop product images or a folder
        </p>
        <p className="text-xs text-charcoal-400 mt-1 leading-snug">
          KAYA auto-matches by filename then uses smart-match (AI) for the
          rest. Confidence pill shows how sure we are.
        </p>
        <div className="mt-3 flex gap-2 justify-center flex-wrap">
          <button
            type="button"
            onClick={() => filesRef.current?.click()}
            className="btn-outline text-xs"
          >
            <Upload size={12} /> Select files
          </button>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="btn-outline text-xs"
          >
            <FolderUp size={12} /> Select folder
          </button>
        </div>
        <input
          ref={filesRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          {...({ webkitdirectory: "", directory: "" } as Record<
            string,
            string
          >)}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="Auto" value={autoMatches.length} tone="sage" />
        <Stat
          label="AI accepted"
          value={aiAccepted.length}
          tone="mustard"
        />
        <Stat label="Pending" value={aiPending.length} tone="clay" />
        <Stat label="Unmatched" value={unmatched.length} tone="charcoal" />
      </div>

      {autoMatches.length > 0 && (
        <Section
          title={`${autoMatches.length} auto-matched`}
          tone="sage"
          icon={<CheckCircle2 size={14} />}
          subtitle="High-confidence filename match — auto-accepted."
        >
          {autoMatches.map((m) => (
            <MatchRow
              key={m.fileId}
              match={m}
              autoAccepted
              onReject={onReject}
              onRemove={onRemove}
            />
          ))}
        </Section>
      )}

      {aiPending.length > 0 && (
        <Section
          title={`${aiPending.length} AI suggestion${
            aiPending.length === 1 ? "" : "s"
          }`}
          tone="mustard"
          icon={<Sparkles size={14} />}
          subtitle="Accept if the match looks right, reject to unmatch."
        >
          {aiPending.map((m) => (
            <MatchRow
              key={m.fileId}
              match={m}
              onAccept={onAccept}
              onReject={onReject}
              onRemove={onRemove}
            />
          ))}
        </Section>
      )}

      {aiAccepted.length > 0 && (
        <Section
          title={`${aiAccepted.length} accepted suggestion${
            aiAccepted.length === 1 ? "" : "s"
          }`}
          tone="mustard"
          icon={<CheckCircle2 size={14} />}
        >
          {aiAccepted.map((m) => (
            <MatchRow
              key={m.fileId}
              match={m}
              onReject={onReject}
              onRemove={onRemove}
            />
          ))}
        </Section>
      )}

      {unmatched.length > 0 && (
        <Section
          title={`${unmatched.length} unmatched`}
          tone="charcoal"
          icon={<AlertCircle size={14} />}
          subtitle="Pick a product manually or remove the file."
        >
          {unmatched.map((m) => (
            <UnmatchedRow
              key={m.fileId}
              match={m}
              imported={imported}
              shops={shops}
              onAssign={onAssign}
              onRemove={onRemove}
            />
          ))}
        </Section>
      )}

      <div className="flex gap-2 sticky bottom-0 bg-cream-50 pt-3 border-t border-charcoal-100/40 -mx-5 px-5">
        <button
          onClick={onApply}
          disabled={busy}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Uploading…
            </>
          ) : (
            `Apply ${autoMatches.length + aiAccepted.length} image${
              autoMatches.length + aiAccepted.length === 1 ? "" : "s"
            }`
          )}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          className="btn-outline text-xs"
        >
          Skip to summary
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sage" | "mustard" | "clay" | "charcoal";
}) {
  const toneClass =
    tone === "sage"
      ? "bg-sage-100 text-sage-700"
      : tone === "mustard"
      ? "bg-mustard-100 text-mustard-700"
      : tone === "clay"
      ? "bg-clay-400/15 text-clay-600"
      : "bg-cream-100 text-charcoal-700";
  return (
    <div className={`rounded-2xl px-3 py-2 ${toneClass}`}>
      <p className="text-[9px] uppercase tracking-wider font-bold opacity-80">
        {label}
      </p>
      <p className="display text-xl font-bold leading-tight">{value}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  tone,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  tone: "sage" | "mustard" | "clay" | "charcoal";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "sage"
      ? "border-sage-300/40 bg-sage-100/40"
      : tone === "mustard"
      ? "border-mustard-400/40 bg-mustard-100/40"
      : tone === "clay"
      ? "border-clay-400/40 bg-clay-400/5"
      : "border-charcoal-100 bg-cream-100/40";
  const titleColor =
    tone === "sage"
      ? "text-sage-700"
      : tone === "mustard"
      ? "text-mustard-700"
      : tone === "clay"
      ? "text-clay-600"
      : "text-charcoal-700";
  return (
    <div className={`card-base p-4 ${toneClass}`}>
      <div className={`flex items-center gap-2 mb-2 ${titleColor}`}>
        {icon}
        <p className="font-semibold text-sm">{title}</p>
      </div>
      {subtitle && (
        <p className="text-[11px] text-charcoal-400 -mt-1 mb-2 leading-snug">
          {subtitle}
        </p>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MatchRow({
  match,
  autoAccepted,
  onAccept,
  onReject,
  onRemove,
}: {
  match: ImageMatch;
  autoAccepted?: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const previewUrl = useMemo(
    () => URL.createObjectURL(match.file),
    [match.file]
  );
  return (
    <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-charcoal-100/60">
      <img
        src={previewUrl}
        alt={match.file.name}
        className="w-12 h-12 rounded-xl object-cover bg-cream-100 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-semibold text-xs truncate">{match.productName}</p>
          {match.confidence > 0 && (
            <ConfidencePill confidence={match.confidence} />
          )}
          {autoAccepted && (
            <span className="chip bg-sage-100 text-sage-700 text-[9px]">
              Auto
            </span>
          )}
          {match.uploadState === "uploaded" && (
            <span className="chip bg-sage-100 text-sage-700 text-[9px]">
              ✓ Uploaded
            </span>
          )}
          {match.uploadState === "failed" && (
            <span className="chip bg-clay-400/15 text-clay-600 text-[9px]">
              Failed
            </span>
          )}
        </div>
        <p className="text-[10px] text-charcoal-400 truncate">
          {match.file.name}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onAccept && match.decision !== "accepted" && (
          <button
            onClick={() => onAccept(match.fileId)}
            className="rounded-full bg-sage-300 hover:bg-sage-500 text-charcoal-900 px-2.5 py-1 text-[10px] font-bold transition"
          >
            Accept
          </button>
        )}
        {onReject && (
          <button
            onClick={() => onReject(match.fileId)}
            className="rounded-full bg-charcoal-100 hover:bg-clay-400 hover:text-cream-50 text-charcoal-700 px-2.5 py-1 text-[10px] font-bold transition"
          >
            Reject
          </button>
        )}
        <button
          onClick={() => onRemove(match.fileId)}
          aria-label="Remove file"
          className="grid place-items-center w-6 h-6 rounded-full bg-charcoal-100 hover:bg-charcoal-200 text-charcoal-700"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
}

function UnmatchedRow({
  match,
  imported,
  shops,
  onAssign,
  onRemove,
}: {
  match: ImageMatch;
  imported: ImportRow[];
  shops: Shop[];
  onAssign: (id: string, productId: string) => void;
  onRemove: (id: string) => void;
}) {
  const previewUrl = useMemo(
    () => URL.createObjectURL(match.file),
    [match.file]
  );
  return (
    <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-charcoal-100/60">
      <img
        src={previewUrl}
        alt={match.file.name}
        className="w-12 h-12 rounded-xl object-cover bg-cream-100 shrink-0"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-[11px] text-charcoal-700 truncate font-semibold">
          {match.file.name}
        </p>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onAssign(match.fileId, e.target.value);
          }}
          className="w-full rounded-full px-3 py-1 text-[11px] font-semibold border border-charcoal-100 bg-white"
        >
          <option value="">Assign to product…</option>
          {imported.map((r) => {
            const shop = shops.find((s) => s.id === r.product.shopId);
            return (
              <option key={r.product.id} value={r.product.id}>
                {r.product.name} {shop ? `· ${shop.name}` : ""}
              </option>
            );
          })}
        </select>
      </div>
      <button
        onClick={() => onRemove(match.fileId)}
        aria-label="Remove file"
        className="grid place-items-center w-6 h-6 rounded-full bg-charcoal-100 hover:bg-charcoal-200 text-charcoal-700 shrink-0"
      >
        <X size={10} />
      </button>
    </div>
  );
}

function SummaryView({
  imported,
  matches,
  missingProducts,
  shops,
  onImageUpdate,
  onClose,
}: {
  imported: ImportRow[];
  matches: ImageMatch[];
  missingProducts: ImportRow[];
  shops: Shop[];
  onImageUpdate: (productId: string, url: string) => void;
  onClose: () => void;
}) {
  const autoUploaded = matches.filter(
    (m) =>
      (m.matchType === "exact_filename" ||
        m.matchType === "exact_normalized") &&
      m.uploadState === "uploaded"
  ).length;
  const aiUploaded = matches.filter(
    (m) =>
      m.matchType === "ai_suggestion" &&
      m.decision === "accepted" &&
      m.uploadState === "uploaded"
  ).length;
  const aiSuggested = matches.filter(
    (m) => m.matchType === "ai_suggestion"
  ).length;
  const failed = matches.filter((m) => m.uploadState === "failed").length;

  return (
    <div className="space-y-4">
      <div className="card-base border-sage-300/40 bg-sage-100 p-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-sage-300 text-charcoal-900 shrink-0">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <p className="font-semibold text-sm">Import complete</p>
            <p className="text-xs text-charcoal-700 mt-0.5 leading-snug">
              {missingProducts.length === 0
                ? "Every product has an image — catalogue ready to go."
                : `${missingProducts.length} product${
                    missingProducts.length === 1 ? "" : "s"
                  } still need an image. Upload below or any time from the product editor.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryStat label="Imported" value={imported.length} tone="charcoal" />
        <SummaryStat label="Auto matched" value={autoUploaded} tone="sage" />
        <SummaryStat
          label="AI matched"
          value={aiUploaded}
          tone="mustard"
          hint={aiSuggested > 0 ? `${aiSuggested} suggested` : undefined}
        />
        <SummaryStat
          label="Still missing"
          value={missingProducts.length}
          tone={missingProducts.length === 0 ? "sage" : "clay"}
        />
      </div>

      {failed > 0 && (
        <div className="card-base border-clay-400/40 bg-clay-400/5 p-3 text-xs text-clay-600 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            {failed} upload{failed === 1 ? "" : "s"} failed. Try again from the
            Missing Images queue below.
          </span>
        </div>
      )}

      {missingProducts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon size={14} className="text-charcoal-400" />
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Missing images queue
            </p>
          </div>
          <p className="text-[10px] text-charcoal-400 leading-snug -mt-1">
            Tip: matching is fastest when image filenames roughly match product
            names ("Ideal Milk 400g.jpg" → "Ideal Milk 400g").
          </p>
          {missingProducts.map((r) => {
            const shop = shops.find((s) => s.id === r.product.shopId);
            return (
              <div key={r.product.id} className="card-base p-3">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-sm truncate flex-1">
                    {r.product.name}
                  </p>
                  <span className="text-[10px] text-charcoal-400 shrink-0">
                    {shop?.emoji} {shop?.name}
                  </span>
                </div>
                <ImageUpload
                  value={r.product.image}
                  onChange={(url) => onImageUpdate(r.product.id, url)}
                  bucket="product-images"
                  folder="catalog"
                  label=""
                  aspect="square"
                />
              </div>
            );
          })}
        </div>
      )}

      <button onClick={onClose} className="btn-primary w-full">
        Done
      </button>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "sage" | "mustard" | "clay" | "charcoal";
  hint?: string;
}) {
  const toneClass =
    tone === "sage"
      ? "bg-sage-100 text-sage-700"
      : tone === "mustard"
      ? "bg-mustard-100 text-mustard-700"
      : tone === "clay"
      ? "bg-clay-400/15 text-clay-600"
      : "bg-cream-100 text-charcoal-700";
  return (
    <div className={`rounded-2xl px-3 py-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">
        {label}
      </p>
      <p className="display text-2xl font-bold leading-tight">{value}</p>
      {hint && (
        <p className="text-[10px] opacity-80 leading-tight mt-0.5">{hint}</p>
      )}
    </div>
  );
}
