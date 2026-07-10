import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation2,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LocationConfirmation, Recipient } from "@/types";
import {
  buildMapsLink,
  fetchLocationConfirmationByToken,
} from "@/lib/locationConfirmations";

type Coords = { lat: number; lng: number; accuracy: number } | null;

/**
 * Public, mobile-first delivery location confirmation page.
 *
 * Opened by the recipient from a WhatsApp / SMS link that carries
 * a single-use token. No sign-in required. On submit we update:
 *
 *   1. `location_confirmations`  — the token'd request record
 *   2. `recipients`              — so the sender's saved profile
 *                                  keeps the pin for future orders
 *   3. `orders.recipient`        — updates this order's snapshot
 *                                  so ops immediately see the pin
 *
 * Anon writes are gated by RLS to these three tables today. When
 * KAYA moves to authenticated ops later, the token itself keeps
 * this page safe: without it you cannot address any of the rows.
 */
export default function ConfirmLocation() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmation, setConfirmation] =
    useState<LocationConfirmation | null>(null);

  const [coords, setCoords] = useState<Coords>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [landmark, setLandmark] = useState("");
  const [directions, setDirections] = useState("");
  const [requestCall, setRequestCall] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // ---- Load by token ------------------------------------------------
  useEffect(() => {
    let mounted = true;
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const c = await fetchLocationConfirmationByToken(token);
        if (!mounted) return;
        if (!c) {
          setNotFound(true);
        } else {
          setConfirmation(c);
          setLandmark(c.landmark ?? "");
          setDirections(c.writtenDirections ?? "");
          setRequestCall(c.requestCall ?? false);
          if (c.latitude != null && c.longitude != null) {
            setCoords({
              lat: c.latitude,
              lng: c.longitude,
              accuracy: 0,
            });
          }
          if (c.status === "verified") setDone(true);
        }
      } catch (err) {
        console.error("[KAYA] Fetch location confirmation failed:", err);
        setNotFound(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  // ---- GPS ----------------------------------------------------------
  const requestGps = () => {
    if (!("geolocation" in navigator)) {
      setLocationError("GPS isn't available on this device.");
      return;
    }
    setLocationError("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocating(false);
        toast.success("Location captured");
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location access was blocked. You can still submit a landmark and directions below."
            : "Couldn't get your location. Try again or add a landmark below."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ---- Submit -------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    const hasAnyInfo =
      coords != null ||
      landmark.trim().length > 0 ||
      directions.trim().length > 0 ||
      requestCall;
    if (!hasAnyInfo) {
      toast.error(
        "Please share your GPS, a landmark, or written directions."
      );
      return;
    }
    setSubmitting(true);
    const at = new Date().toISOString();
    const mapLink = coords
      ? buildMapsLink(coords.lat, coords.lng)
      : confirmation.mapLink ?? null;

    // 1. Update the confirmation record — this is the critical write.
    const { error: cErr } = await supabase
      .from("location_confirmations")
      .update({
        verification_status: "verified",
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        map_link: mapLink,
        landmark: landmark.trim() || null,
        written_directions: directions.trim() || null,
        request_call: requestCall,
        confirmed_at: at,
        followup_note: null,
      })
      .eq("token", confirmation.token);

    if (cErr) {
      setSubmitting(false);
      toast.error("Something went wrong. Please try again.");
      console.error(cErr);
      return;
    }

    // 2. Update the sender's saved recipient so future orders
    //    ship without needing another confirmation cycle.
    try {
      const recipientPatch: Record<string, unknown> = {};
      if (landmark.trim()) recipientPatch.landmark = landmark.trim();
      if (directions.trim()) recipientPatch.notes = directions.trim();
      if (coords) {
        recipientPatch.data = {
          latitude: coords.lat,
          longitude: coords.lng,
          mapsLink: mapLink ?? undefined,
        };
      }
      if (Object.keys(recipientPatch).length > 0) {
        await supabase
          .from("recipients")
          .update(recipientPatch)
          .eq("id", confirmation.recipientId);
      }
    } catch (err) {
      console.warn("Recipient profile update failed (non-fatal):", err);
    }

    // 3. Update the order's snapshot of the recipient so ops sees
    //    the pin on THIS order without waiting for the next cycle.
    try {
      const { data: orderRow } = await supabase
        .from("orders")
        .select("recipient")
        .eq("id", confirmation.orderId)
        .maybeSingle();
      if (orderRow?.recipient) {
        const snap = orderRow.recipient as Recipient;
        const updated: Recipient = {
          ...snap,
          latitude: coords?.lat ?? snap.latitude,
          longitude: coords?.lng ?? snap.longitude,
          mapsLink: mapLink ?? snap.mapsLink,
          closestLandmark: landmark.trim() || snap.closestLandmark,
          deliveryNotes: directions.trim() || snap.deliveryNotes,
        };
        await supabase
          .from("orders")
          .update({ recipient: updated })
          .eq("id", confirmation.orderId);
      }
    } catch (err) {
      console.warn("Order snapshot update failed (non-fatal):", err);
    }

    setSubmitting(false);
    setDone(true);
    toast.success("Thanks — KAYA has your location.");
  };

  // ---- States -------------------------------------------------------
  if (loading) {
    return (
      <Splash>
        <div className="flex items-center gap-3 justify-center text-charcoal-700">
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">Loading your confirmation…</span>
        </div>
      </Splash>
    );
  }

  if (notFound || !confirmation) {
    return (
      <Splash>
        <div className="text-center">
          <div className="grid place-items-center mx-auto w-14 h-14 rounded-2xl bg-clay-400/15 text-clay-600 mb-3">
            <AlertTriangle size={22} />
          </div>
          <h1 className="display text-xl font-semibold text-charcoal-900">
            This link isn't valid
          </h1>
          <p className="text-sm text-charcoal-400 mt-2 max-w-xs mx-auto">
            The confirmation link may have expired or been used already.
            Please reply to the person who sent you the delivery so KAYA
            can send a fresh one.
          </p>
        </div>
      </Splash>
    );
  }

  if (done) {
    return (
      <Splash>
        <div className="text-center max-w-sm mx-auto">
          <div className="grid place-items-center mx-auto w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mb-4 shadow-soft">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="display text-2xl font-semibold text-charcoal-900">
            You're all set,{" "}
            {confirmation.recipientName.split(" ")[0]}!
          </h1>
          <p className="text-sm text-charcoal-700 mt-3 leading-relaxed">
            KAYA has your delivery details. We'll be in touch shortly when
            your care package is on the way.
          </p>
          {coords && (
            <a
              href={buildMapsLink(coords.lat, coords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-charcoal-900 rounded-full bg-cream-100 border border-charcoal-100 px-3 py-1.5 hover:border-charcoal-400"
            >
              <MapPin size={12} /> View your pinned location
            </a>
          )}
          {requestCall && (
            <p className="mt-4 rounded-2xl bg-mustard-100 border border-mustard-400/40 text-mustard-700 text-xs font-semibold px-3 py-2">
              <Phone size={11} className="inline mr-1" /> A KAYA team member
              will call you shortly to help.
            </p>
          )}
        </div>
      </Splash>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 text-charcoal-800">
      <Helmet>
        <title>Confirm your KAYA delivery location</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      {/* Header */}
      <header className="border-b border-charcoal-100/60 bg-cream-50/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-md px-4 h-14 flex items-center gap-2">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-mustard-400 text-charcoal-900 display font-bold shadow-soft">
            K
          </div>
          <div>
            <p className="display text-lg font-semibold leading-none">
              KAYA
            </p>
            <p className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-600 mt-0.5">
              Delivery confirmation
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 pb-24">
        {/* Hero */}
        <section className="rounded-3xl bg-white border border-charcoal-100 shadow-card p-5 mb-4">
          <p className="text-[10px] uppercase tracking-eyebrow font-bold text-mustard-600">
            Hi {confirmation.recipientName.split(" ")[0]},
          </p>
          <h1 className="display text-2xl font-semibold text-charcoal-900 leading-tight mt-1.5">
            Confirm your delivery location
          </h1>
          <p className="text-sm text-charcoal-700 leading-relaxed mt-2">
            Someone has sent you a KAYA delivery. Please share your exact
            location so our driver can find you smoothly.
          </p>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-2">
            <ShieldCheck
              size={14}
              className="text-emerald-600 shrink-0 mt-0.5"
            />
            <p className="text-[11px] text-emerald-700 leading-snug">
              Your location is only used by the KAYA team to make sure your
              delivery arrives safely. We never share it publicly.
            </p>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1 · GPS */}
          <section className="rounded-3xl bg-white border border-charcoal-100 shadow-soft p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-mustard-100 text-mustard-700 shrink-0">
                <Navigation2 size={16} />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
                  Step 1 · best option
                </p>
                <h2 className="display font-semibold text-lg leading-tight">
                  Share your current location
                </h2>
                <p className="text-xs text-charcoal-400 mt-1 leading-snug">
                  Fastest way for our driver to find you.
                </p>
              </div>
            </div>
            {coords ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-500 text-cream-50 shrink-0">
                  <CheckCircle2 size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-700">
                    Location captured
                  </p>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5 tabular-nums">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    {coords.accuracy > 0 &&
                      ` · ±${Math.round(coords.accuracy)}m`}
                  </p>
                  <a
                    href={buildMapsLink(coords.lat, coords.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-charcoal-900 underline"
                  >
                    <MapPin size={11} /> Preview on Google Maps
                  </a>
                  <button
                    type="button"
                    onClick={requestGps}
                    className="mt-2 block text-[11px] font-semibold text-charcoal-400 hover:text-charcoal-900"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={requestGps}
                disabled={locating}
                className="btn-yellow w-full py-3.5 text-sm"
              >
                {locating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Getting your
                    location…
                  </>
                ) : (
                  <>
                    <MapPin size={16} /> Share my location
                  </>
                )}
              </button>
            )}
            {locationError && (
              <p className="mt-2 text-[11px] text-clay-600 leading-snug">
                {locationError}
              </p>
            )}
          </section>

          {/* Step 2 · Landmark */}
          <section className="rounded-3xl bg-white border border-charcoal-100 shadow-soft p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-cream-100 text-charcoal-700 shrink-0">
                <MapPin size={16} />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
                  Step 2
                </p>
                <h2 className="display font-semibold text-lg leading-tight">
                  Closest landmark
                </h2>
                <p className="text-xs text-charcoal-400 mt-1 leading-snug">
                  A shop, junction, church, or school nearby.
                </p>
              </div>
            </div>
            <input
              type="text"
              value={landmark}
              onChange={(e) =>
                setLandmark(e.target.value.slice(0, 120))
              }
              placeholder="e.g. Opposite Melcom, next to the blue gate"
              className="input-base"
              maxLength={120}
            />
          </section>

          {/* Step 3 · Directions */}
          <section className="rounded-3xl bg-white border border-charcoal-100 shadow-soft p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-cream-100 text-charcoal-700 shrink-0">
                <MessageSquare size={16} />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
                  Step 3 · optional
                </p>
                <h2 className="display font-semibold text-lg leading-tight">
                  Written directions
                </h2>
                <p className="text-xs text-charcoal-400 mt-1 leading-snug">
                  How should the driver find your gate?
                </p>
              </div>
            </div>
            <textarea
              value={directions}
              onChange={(e) =>
                setDirections(e.target.value.slice(0, 400))
              }
              placeholder="e.g. After the second speed bump, take the second right. Our house has a black gate with number 22 painted on it."
              className="input-base min-h-[100px] resize-none"
              rows={4}
              maxLength={400}
            />
            <p className="text-[10px] text-charcoal-400 mt-1 text-right tabular-nums">
              {directions.length}/400
            </p>
          </section>

          {/* Request a call */}
          <label className="flex items-start gap-3 rounded-3xl bg-white border border-charcoal-100 shadow-soft p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={requestCall}
              onChange={(e) => setRequestCall(e.target.checked)}
              className="mt-1 w-5 h-5 accent-charcoal-800"
            />
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Phone size={14} className="text-mustard-600" />
                Request a phone call from KAYA
              </span>
              <span className="text-[11px] text-charcoal-400 leading-snug block mt-1">
                Someone from our team will call you to help figure out the
                best directions.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="btn-emerald w-full py-4 text-base"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Confirm delivery location
              </>
            )}
          </button>
          <p className="text-[11px] text-charcoal-400 text-center leading-snug">
            You'll get a WhatsApp or SMS update the moment your KAYA
            delivery is on the way.
          </p>
        </form>
      </main>
    </div>
  );
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-50 grid place-items-center px-4 py-10">
      <Helmet>
        <title>KAYA · Confirm delivery location</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="max-w-sm w-full">{children}</div>
    </div>
  );
}
