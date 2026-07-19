
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Crosshair,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Phone,
  RotateCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { City, Recipient, Relationship } from "@/types";
import { useApp } from "@/contexts/AppContext";

const RELATIONSHIPS: { label: Relationship; emoji: string }[] = [
  { label: "Mom", emoji: "❤️" },
  { label: "Dad", emoji: "💙" },
  { label: "Grandma", emoji: "👵" },
  { label: "Grandpa", emoji: "👴" },
  { label: "Family Home", emoji: "🏠" },
  { label: "Student", emoji: "🎓" },
  { label: "Sibling", emoji: "🤝" },
  { label: "Friend", emoji: "🌟" },
  { label: "Spouse", emoji: "💍" },
];

/**
 * Parse latitude/longitude from a Google Maps URL or a plain "lat,lng"
 * pair. Supports the common URL patterns:
 *   · ?q=lat,lng
 *   · @lat,lng,zoom
 *   · !3dlat!4dlng (place URLs)
 *   · "lat,lng" raw
 */
function parseLatLng(input: string): { lat: number; lng: number } | null {
  const cleaned = input.trim();
  if (!cleaned) return null;
  const ll = cleaned.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };
  const at = cleaned.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = cleaned.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  const place = cleaned.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (place) return { lat: parseFloat(place[1]), lng: parseFloat(place[2]) };
  return null;
}

export default function AddRecipientSheet({
  open,
  onClose,
  recipient,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided the sheet enters EDIT mode and saves via updateRecipient. */
  recipient?: Recipient;
}) {
  const {
    addRecipient,
    updateRecipient,
    deliveryAreas,
    refreshDeliveryAreas,
    addWaitlistEntry,
    user,
  } = useApp();
  const navigate = useNavigate();
  const isEditing = !!recipient;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState<City>("Accra");
  const [region, setRegion] = useState("Greater Accra");
  const [townArea, setTownArea] = useState("");
  const [address, setAddress] = useState("");
  const [closestLandmark, setClosestLandmark] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [rel, setRel] = useState(RELATIONSHIPS[0]);
  const [mapsInput, setMapsInput] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMapSection, setShowMapSection] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState("");
  // Mobile networks are slower than desktop — track the delivery-
  // area fetch state so the Town/Area dropdown shows an obvious
  // "Loading…" indicator (not just an empty select), and a retry
  // button if the mobile connection dropped the fetch mid-flight.
  // Without this, a fresh-account mobile user opens the sheet
  // before the fire-and-forget fetch resolves and sees a blank
  // dropdown they assume is broken.
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState("");

  // ⚠️ STABLE-REF PATTERN (fixed 2026-Q3, do not regress):
  // `refreshDeliveryAreas` is created inside AppContext's useMemo,
  // so its identity changes on every parent re-render. If we put
  // it directly in useEffect deps, the effect fires on every
  // parent state change and continuously reflushes areasLoading
  // — which on mobile makes the loading indicator flash so fast
  // it never appears to the user, and can even cause the fetch
  // to be cancelled mid-flight when the effect re-runs. Store
  // the latest function in a ref so the effect can call the
  // freshest version without depending on its identity.
  const refreshRef = useRef(refreshDeliveryAreas);
  useEffect(() => {
    refreshRef.current = refreshDeliveryAreas;
  }, [refreshDeliveryAreas]);

  // Hydrate / reset the form every time the sheet opens. Editing pulls
  // every saved field; adding zeroes everything back to defaults.
  useEffect(() => {
    if (!open) return;
    // Force a fresh fetch of delivery areas from the server so the
    // Town / Area dropdown always reflects the latest admin catalog
    // — even when this browser’s AppContext was last hydrated before
    // the admin added new towns. Prevents "admin added an area but
    // customer can't see it in the dropdown" (the poll cadence is 20s
    // and localStorage caches the previous snapshot on first paint).
    //
    // Mobile-safe: explicit loading + error state surfaced in the
    // dropdown so the user knows something is happening even when
    // the mobile network is slow. Retry button lets them recover
    // without closing / reopening the sheet.
    let cancelled = false;
    setAreasLoading(true);
    setAreasError("");
    console.log(
      "[KAYA] AddRecipientSheet mount → fetching delivery areas…"
    );
    refreshRef
      .current()
      .then((count) => {
        if (cancelled) return;
        console.log(
          "[KAYA] AddRecipientSheet fetch resolved with",
          count,
          "rows"
        );
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Couldn’t reach the delivery catalog";
        setAreasError(msg);
        console.warn(
          "[KAYA] AddRecipientSheet refreshDeliveryAreas failed:",
          err
        );
      })
      .finally(() => {
        if (!cancelled) setAreasLoading(false);
      });
    if (recipient) {
      setFullName(recipient.fullName);
      setPhone(recipient.phone);
      setCity(recipient.city);
      setRegion(recipient.region ?? "Greater Accra");
      setTownArea(recipient.townArea ?? "");
      setAddress(recipient.address);
      setClosestLandmark(recipient.closestLandmark ?? "");
      setDeliveryNotes(recipient.deliveryNotes ?? "");
      const matchedRel =
        RELATIONSHIPS.find((r) => r.label === recipient.relationship) ??
        RELATIONSHIPS[0];
      setRel(matchedRel);
      setLatitude(recipient.latitude ?? null);
      setLongitude(recipient.longitude ?? null);
      const hasPin =
        recipient.latitude != null && recipient.longitude != null;
      setMapsInput(
        hasPin ? `${recipient.latitude},${recipient.longitude}` : ""
      );
      setShowMapSection(hasPin);
    } else {
      setFullName("");
      setPhone("");
      setCity("Accra");
      setRegion("Greater Accra");
      setTownArea("");
      setAddress("");
      setClosestLandmark("");
      setDeliveryNotes("");
      setRel(RELATIONSHIPS[0]);
      setMapsInput("");
      setLatitude(null);
      setLongitude(null);
      setShowMapSection(false);
    }
    setError("");
    return () => {
      cancelled = true;
    };
    // The eslint-disable-next-line comment was removed.
    // If 'react-hooks/exhaustive-deps' rule is still needed for other effects,
    // ensure it's configured in your ESLint setup.
  }, [open, recipient]);

  // Only entries the customer can pick from the dropdown.
  const cityAreas = useMemo(
    () =>
      deliveryAreas
        .filter((a) => a.city === city && a.active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [deliveryAreas, city]
  );

  // When editing, surface the saved townArea even if it's been
  // deactivated by ops so the form doesn't silently clear it.
  const dropdownAreas = useMemo(() => {
    if (
      recipient?.townArea &&
      city === recipient.city &&
      !cityAreas.some((a) => a.name === recipient.townArea)
    ) {
      return [
        {
          id: `_legacy_${recipient.townArea}`,
          name: recipient.townArea,
          city,
          region,
          active: true,
          serviceable: true,
          createdAt: "",
          zoneLabel: undefined,
        },
        ...cityAreas,
      ];
    }
    return cityAreas;
  }, [cityAreas, recipient, city, region]);

  const selectedArea =
    dropdownAreas.find((a) => a.name === townArea) ?? null;
  const isUnserviceable = !!selectedArea && !selectedArea.serviceable;

  // Reset Town/Area if the user changes city to one without a matching area.
  useEffect(() => {
    if (townArea && !dropdownAreas.find((a) => a.name === townArea)) {
      setTownArea("");
    }
  }, [city, townArea, dropdownAreas]);

  if (!open) return null;

  const retryLoadAreas = () => {
    setAreasLoading(true);
    setAreasError("");
    console.log("[KAYA] AddRecipientSheet retry → fetching delivery areas…");
    refreshRef
      .current()
      .catch((err) => {
        const msg =
          err instanceof Error
            ? err.message
            : "Couldn’t reach the delivery catalog";
        setAreasError(msg);
        console.warn("[KAYA] AddRecipientSheet retry failed:", err);
      })
      .finally(() => setAreasLoading(false));
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setError("");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(+pos.coords.latitude.toFixed(6));
        setLongitude(+pos.coords.longitude.toFixed(6));
        setIsLocating(false);
        toast.success("Pin captured from your location");
      },
      (err) => {
        setIsLocating(false);
        setError(`Couldn't get location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const applyMapsInput = () => {
    const parsed = parseLatLng(mapsInput);
    if (parsed) {
      setLatitude(+parsed.lat.toFixed(6));
      setLongitude(+parsed.lng.toFixed(6));
      setError("");
      toast.success("Pin captured");
    } else {
      setError(
        "Couldn't read coordinates. Paste a Google Maps URL or 'lat,lng'."
      );
    }
  };

  const clearPin = () => {
    setLatitude(null);
    setLongitude(null);
    setMapsInput("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Guest guard — recipients are attached to a customer profile so
    // saving requires an account. Route the visitor to sign in and
    // return them to their cart afterwards; cart items survive the
    // round-trip via localStorage.
    if (!user) {
      toast.info("Sign in to save this recipient", {
        description: "Your cart will be waiting when you get back.",
      });
      onClose();
      navigate("/login?next=/cart");
      return;
    }
    if (!fullName.trim()) return setError("Full name is required.");
    if (!phone.trim()) return setError("Phone number is required.");
    if (!townArea)
      return setError("Choose the Town / Area from the dropdown.");
    if (!address.trim()) return setError("Full address is required.");
    if (!closestLandmark.trim())
      return setError(
        "Closest landmark is required — it helps the courier find the place."
      );
    if (isUnserviceable) {
      return setError(
        `KAYA isn't delivering to ${townArea} yet. Join the waitlist below and we'll notify you when we expand.`
      );
    }

    const mapsLink =
      latitude != null && longitude != null
        ? `https://maps.google.com/?q=${latitude},${longitude}`
        : undefined;

    const patch = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city,
      relationship: rel.label,
      emoji: rel.emoji,
      region,
      townArea,
      closestLandmark: closestLandmark.trim(),
      deliveryNotes: deliveryNotes.trim() || undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      mapsLink,
    };

    if (isEditing && recipient) {
      updateRecipient(recipient.id, patch);
      toast.success(`${fullName.trim()}'s address updated`);
    } else {
      addRecipient(patch);
      toast.success(`${fullName.trim()} saved`);
    }
    onClose();
  };

  const handleJoinWaitlist = () => {
    if (!user) return;
    addWaitlistEntry({
      name: user.name,
      email: user.email,
      phone: user.phone,
      city,
      source: "signup",
    });
    toast.success(`You'll be notified when ${townArea} opens up.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-charcoal-900/40 backdrop-blur-sm animate-fade-in-up"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md bg-cream-50 rounded-t-3xl sm:rounded-3xl shadow-hi p-6 max-h-[92vh] overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-400">
              {isEditing ? "Update" : "New"}
            </div>
            <h2 className="display text-2xl font-semibold">
              {isEditing ? "Edit address" : "Add a loved one"}
            </h2>
            {isEditing && (
              <p className="text-xs text-charcoal-400 mt-0.5">
                Fix typos or update the landmark without removing the recipient.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center w-9 h-9 rounded-full bg-white border border-charcoal-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-charcoal-700">
              Relationship
            </label>
            <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {RELATIONSHIPS.map((r) => (
                <button
                  type="button"
                  key={r.label}
                  onClick={() => setRel(r)}
                  className={`shrink-0 flex items-center gap-2 rounded-full px-3 py-2 text-sm border transition ${
                    rel.label === r.label
                      ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                      : "bg-white border-charcoal-100 hover:border-charcoal-400"
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-charcoal-700">
              Full name <span className="text-clay-600">*</span>
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-base mt-1"
              placeholder="e.g. Akosua Mensah"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-charcoal-700 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <Phone size={12} className="text-mustard-600" />
                Phone (Ghana) <span className="text-clay-600">*</span>
              </span>
            </label>
            <div className="mt-1 flex gap-2">
              <div className="flex items-center gap-1 px-3 py-3 rounded-2xl border border-charcoal-100 bg-white text-sm font-semibold text-charcoal-700 shrink-0">
                <span>🇬🇭</span>
                <span>+233</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-base"
                placeholder="20 000 0000"
                inputMode="tel"
                required
              />
            </div>
            <p className="text-[11px] text-charcoal-400 mt-1.5">
              Courier uses this to coordinate delivery and confirm receipt.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-charcoal-700">
                Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="input-base mt-1"
              >
                <option value="Greater Accra">Greater Accra</option>
              </select>
              <p className="text-[10px] text-charcoal-400 mt-1">
                More regions coming soon.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-charcoal-700">
                City <span className="text-clay-600">*</span>
              </label>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {(["Accra", "Tema"] as City[]).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCity(c)}
                    className={`rounded-2xl py-2.5 text-xs font-semibold border transition ${
                      city === c
                        ? "bg-mustard-400 border-mustard-400 text-charcoal-900"
                        : "bg-white border-charcoal-100 hover:border-charcoal-400"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-charcoal-700 flex items-center justify-between gap-2">
              <span>
                Town / Area <span className="text-clay-600">*</span>
              </span>
              {areasLoading && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-charcoal-400">
                  <Loader2 size={10} className="animate-spin" />
                  Loading…
                </span>
              )}
            </label>
            <select
              value={townArea}
              onChange={(e) => setTownArea(e.target.value)}
              className="input-base mt-1"
              required
              disabled={areasLoading && dropdownAreas.length === 0}
            >
              <option value="">
                {areasLoading && dropdownAreas.length === 0
                  ? `Loading Town / Area list…`
                  : `Choose a Town / Area in ${city}…`}
              </option>
              {dropdownAreas.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                  {!a.serviceable && " — not yet serviceable"}
                </option>
              ))}
            </select>
            {areasError && (
              <div className="mt-2 rounded-2xl bg-clay-400/10 border border-clay-400/40 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    size={13}
                    className="shrink-0 mt-0.5 text-clay-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-clay-600">
                      Couldn’t load Town / Area list
                    </p>
                    <p className="text-[11px] text-charcoal-700 mt-0.5 leading-snug">
                      Check your connection and try again.
                    </p>
                    <p className="text-[10px] text-charcoal-400 mt-1 leading-snug break-all">
                      {areasError}
                    </p>
                    <button
                      type="button"
                      onClick={retryLoadAreas}
                      disabled={areasLoading}
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-charcoal-900 hover:bg-charcoal-700 text-cream-50 px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-60"
                    >
                      {areasLoading ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <RotateCw size={11} />
                      )}
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!areasLoading &&
              !areasError &&
              dropdownAreas.length === 0 && (
                <div className="mt-2 rounded-2xl bg-cream-100 border border-charcoal-100 p-3">
                  <p className="text-[11px] font-semibold text-charcoal-900">
                    No serviceable areas in {city} yet
                  </p>
                  <p className="text-[11px] text-charcoal-700 mt-0.5 leading-snug">
                    We’re expanding fast — try again in a moment or
                    tap Retry.
                  </p>
                  <button
                    type="button"
                    onClick={retryLoadAreas}
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-white border border-charcoal-100 hover:border-charcoal-400 text-charcoal-900 px-3 py-1.5 text-[11px] font-bold transition"
                  >
                    <RotateCw size={11} /> Retry
                  </button>
                </div>
              )}
          </div>

          {isUnserviceable && (
            <div className="rounded-2xl bg-clay-400/10 border border-clay-400/40 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={14}
                  className="shrink-0 mt-0.5 text-clay-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-clay-600">
                    KAYA is not delivering to {townArea} yet
                  </p>
                  <p className="text-xs text-charcoal-700 mt-0.5 leading-snug">
                    Join the waitlist and we'll notify you the moment we
                    expand.
                  </p>
                  <button
                    type="button"
                    onClick={handleJoinWaitlist}
                    className="mt-2 inline-flex rounded-full bg-clay-400 hover:bg-clay-600 text-cream-50 px-3 py-1.5 text-[11px] font-bold transition"
                  >
                    Join the waitlist
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-charcoal-700">
              Full address <span className="text-clay-600">*</span>
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-base mt-1 min-h-[72px]"
              placeholder="House number, street, neighbourhood details"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-charcoal-700 flex items-center gap-1.5">
              <MapPin size={12} className="text-mustard-600" />
              Closest landmark <span className="text-clay-600">*</span>
            </label>
            <input
              value={closestLandmark}
              onChange={(e) => setClosestLandmark(e.target.value)}
              className="input-base mt-1"
              placeholder="e.g. Opposite Total filling station, near A&C Mall"
              required
            />
            <p className="text-[11px] text-charcoal-400 mt-1.5">
              Required — Ghana addresses are often easier to find by landmark
              than by street number.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-charcoal-700">
              Delivery notes{" "}
              <span className="text-charcoal-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="input-base mt-1 min-h-[56px]"
              placeholder="e.g. Green gate, ring twice, leave with security"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowMapSection((v) => !v)}
              className="w-full flex items-center justify-between gap-2 rounded-2xl bg-white border border-charcoal-100 hover:border-charcoal-400 px-4 py-3 transition"
            >
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-mustard-600" />
                <span className="text-sm font-semibold text-left">
                  Drop a Google Maps pin
                  <span className="text-charcoal-400 font-normal">
                    {" "}
                    (optional)
                  </span>
                </span>
              </span>
              {latitude != null && longitude != null ? (
                <span className="chip bg-sage-100 text-sage-700 text-[10px]">
                  ✓ Pin set
                </span>
              ) : (
                <span className="text-[11px] text-charcoal-400 font-semibold">
                  {showMapSection ? "Hide" : "Add pin"}
                </span>
              )}
            </button>
            {showMapSection && (
              <div className="mt-2 space-y-3 p-4 rounded-2xl bg-cream-100 border border-charcoal-100/60">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={isLocating}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-charcoal-900 text-cream-50 hover:bg-charcoal-700 text-sm font-bold py-2.5 transition disabled:opacity-60"
                >
                  <Crosshair size={14} />
                  {isLocating ? "Locating…" : "Use my current location"}
                </button>
                <div className="text-center text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">
                  or
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-charcoal-700">
                    Paste Google Maps link or "lat,lng"
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={mapsInput}
                      onChange={(e) => setMapsInput(e.target.value)}
                      className="input-base text-xs py-2"
                      placeholder="https://maps.google.com/…  or  5.65,-0.18"
                    />
                    <button
                      type="button"
                      onClick={applyMapsInput}
                      disabled={!mapsInput.trim()}
                      className="btn-outline text-xs disabled:opacity-50 shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                </div>
                {latitude != null && longitude != null && (
                  <div className="card-base p-3 flex items-center gap-2">
                    <span className="grid place-items-center w-9 h-9 rounded-xl bg-sage-300 text-charcoal-900 shrink-0">
                      <MapPin size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-charcoal-400">Pin set</p>
                      <p className="text-xs font-semibold truncate">
                        {latitude.toFixed(5)}, {longitude.toFixed(5)}
                      </p>
                      <a
                        href={`https://maps.google.com/?q=${latitude},${longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-mustard-700 underline mt-0.5"
                      >
                        <ExternalLink size={9} /> Preview on Maps
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={clearPin}
                      className="text-[11px] font-semibold underline text-clay-600 shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-charcoal-400 leading-snug flex items-start gap-1.5">
                  <Info size={11} className="shrink-0 mt-0.5" />
                  <span>
                    The pin helps couriers find the exact gate. We never share
                    your live location.
                  </span>
                </p>
              </div>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-xs px-4 py-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isUnserviceable}
            className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? "Save changes" : "Save recipient"}
          </button>
        </form>
      </div>
    </div>
  );
}
