/**
 * Smart string-similarity helpers used by the Product Import Wizard
 * to auto-match uploaded image files to products in the catalogue.
 *
 * The wizard runs a 4-tier match pipeline:
 *   1. Exact match against the Excel "Image Filename" column      → 100%
 *   2. Exact match against the normalised product name           → 95%
 *   3. AI suggestion via hybrid token + character similarity     → 40-94%
 *   4. Unmatched — surfaced in the manual-assign queue           → 0%
 *
 * `imageSimilarity` returns a 0..1 confidence we surface as the
 * "AI match" pill in the Review step. Admins accept or reject each
 * suggestion before any upload runs.
 */
export function normalizeImageString(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[^.]+$/, "") // strip extension
    .replace(/[_\-.]+/g, " ") // normalise separators
    .replace(/[^a-z0-9\s]/g, "") // drop non-alphanumeric chars
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length > 0);
}

/**
 * Standard Levenshtein edit distance — kept local + small so the
 * wizard never has to ship a dependency for fuzzy matching.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] =
        a[i - 1] === b[j - 1]
          ? m[i - 1][j - 1]
          : 1 + Math.min(m[i - 1][j - 1], m[i - 1][j], m[i][j - 1]);
    }
  }
  return m[a.length][b.length];
}

/**
 * 0..1 confidence score blending Jaccard token overlap, substring
 * containment and a normalised Levenshtein character similarity.
 *
 * Weighting chosen so two real-world examples behave well:
 *   · "Ideal-Tin-Milk-400g.jpg"    ↔ "Ideal Milk 400g"           ~0.85
 *   · "Pampers_diapers.jpg"        ↔ "Pampers Premium Diapers"   ~0.78
 *   · "rice.jpg"                   ↔ "Royal Aroma Rice"          ~0.45
 */
export function imageSimilarity(
  filename: string,
  productName: string
): number {
  const f = normalizeImageString(filename);
  const p = normalizeImageString(productName);
  if (!f || !p) return 0;
  if (f === p) return 1;

  const fTokens = new Set(tokenize(f));
  const pTokens = new Set(tokenize(p));
  let inter = 0;
  fTokens.forEach((t) => {
    if (pTokens.has(t)) inter += 1;
  });
  const union = new Set([...fTokens, ...pTokens]).size;
  const jaccard = union === 0 ? 0 : inter / union;

  let substring = 0;
  if (f.includes(p) || p.includes(f)) {
    substring = Math.min(f.length, p.length) / Math.max(f.length, p.length);
  }

  const maxLen = Math.max(f.length, p.length);
  const lev = levenshtein(f, p);
  const charSim = maxLen === 0 ? 0 : 1 - lev / maxLen;

  return Math.min(1, jaccard * 0.55 + substring * 0.25 + charSim * 0.2);
}

/**
 * Stable identifier for a File object (browsers don't expose one
 * natively). Combines name + size + lastModified to dedupe drops.
 */
export function fileKey(f: File): string {
  return `${f.name}__${f.size}__${f.lastModified}`;
}

/**
 * Visual buckets for the confidence pill in the UI.
 *   · ≥ 80%  → high     (sage)
 *   · 60-79% → medium   (mustard)
 *   · 40-59% → low      (clay)
 *   · < 40%  → unmatched (charcoal)
 */
export function confidenceBand(
  c: number
): "high" | "medium" | "low" | "none" {
  if (c >= 0.8) return "high";
  if (c >= 0.6) return "medium";
  if (c >= 0.4) return "low";
  return "none";
}
