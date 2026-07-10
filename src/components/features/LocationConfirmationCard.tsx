import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation2,
  Phone,
  Send,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import type { Order } from "@/types";
import {
  buildMapsLink,
  buildSmsLink,
  buildWhatsAppLink,
  composeConfirmationMessage,
} from "@/lib/locationConfirmations";

interface Props {
  order: Order;
  isStaff: boolean;
}

/**
 * "Recipient location" section on the OrderDetail page.
 *
 * • Verified via recipient profile OR verified via this order's
 *   confirmation submission → emerald verified card with Google
 *   Maps link, landmark, directions, and (staff-only) tel: link.
 * • Not yet requested → mustard "Create link" card that spins up
 *   a fresh location_confirmation row and returns copy/send
 *   controls in place.
 * • Pending → mustard card showing when the last WhatsApp / SMS
 *   went out, quick-send buttons, copy link / copy message
 *   buttons, and a "Flag for follow-up" affordance.
 * • Needs follow-up → clay-toned card surfacing the ops note plus
 *   the same send / copy actions and a "Clear flag" resolution.
 *
 * Customer view (isStaff=false) collapses to a single gentle
 * status line so senders always know KAYA is on the case
 * without ever seeing the raw actions.
 */
export default function LocationConfirmationCard({ order, isStaff }: Props) {
  const {
    locationConfirmations,
    ensureLocationConfirmation,
    markLocationConfirmationNotified,
    flagLocationConfirmationForFollowup,
    resolveLocationConfirmationFollowup,
  } = useApp();

  const [creating, setCreating] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupNote, setFollowupNote] = useState("");

  const recipient = order.recipient;
  const preVerified =
    typeof recipient.latitude === "number" &&
    typeof recipient.longitude === "number";
  const confirmation = locationConfirmations.find(
    (c) => c.orderId === order.id
  );

  type EffectiveStatus =
    | "verified"
    | "verified_profile"
    | "pending"
    | "needs_followup"
    | "not_requested";

  const status: EffectiveStatus =
    confirmation?.status === "verified"
      ? "verified"
      : preVerified
      ? "verified_profile"
      : confirmation?.status === "needs_followup"
      ? "needs_followup"
      : confirmation
      ? "pending"
      : "not_requested";

  const confirmationUrl = confirmation
    ? `${window.location.origin}/confirm-location/${confirmation.token}`
    : "";
  const message = confirmation
    ? composeConfirmationMessage(recipient.fullName, confirmationUrl)
    : "";

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy — try again");
    }
  };

  // ============================= VERIFIED =============================
  if (status === "verified" || status === "verified_profile") {
    const lat =
      status === "verified"
        ? confirmation!.latitude
        : recipient.latitude;
    const lng =
      status === "verified"
        ? confirmation!.longitude
        : recipient.longitude;
    const landmark =
      status === "verified"
        ? confirmation!.landmark
        : recipient.closestLandmark;
    const directions =
      status === "verified"
        ? confirmation!.writtenDirections
        : recipient.deliveryNotes;
    const mapLink =
      lat != null && lng != null
        ? buildMapsLink(lat, lng)
        : status === "verified"
        ? confirmation!.mapLink
        : recipient.mapsLink;

    return (
      <section className="card-base p-5 mb-4 bg-emerald-50 border-emerald-200">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-emerald-500 text-cream-50 shrink-0 shadow-soft">
            <CheckCircle2 size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-eyebrow font-bold text-emerald-600">
              Recipient location · verified
            </p>
            <h3 className="display text-lg font-semibold text-emerald-700 leading-tight mt-0.5">
              {status === "verified"
                ? `${recipient.fullName.split(" ")[0]} confirmed their location`
                : `${recipient.fullName.split(" ")[0]}'s location is on file`}
            </h3>
            <div className="mt-3 space-y-2.5 text-sm text-charcoal-800">
              {mapLink && (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal-900 hover:underline"
                >
                  <MapPin size={14} /> Open in Google Maps
                  <ExternalLink size={11} />
                </a>
              )}
              {lat != null && lng != null && (
                <p className="text-[11px] text-charcoal-400 tabular-nums">
                  Pin: {lat.toFixed(5)}, {lng.toFixed(5)}
                </p>
              )}
              {landmark && (
                <div>
                  <p className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
                    Landmark
                  </p>
                  <p className="text-sm mt-0.5">{landmark}</p>
                </div>
              )}
              {directions && (
                <div>
                  <p className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
                    Directions
                  </p>
                  <p className="text-sm mt-0.5 leading-relaxed">
                    {directions}
                  </p>
                </div>
              )}
              {isStaff && (
                <a
                  href={`tel:${recipient.phone}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-600 mt-1"
                >
                  <Phone size={13} /> {recipient.phone}
                </a>
              )}
              {status === "verified" && confirmation?.requestCall && (
                <p className="rounded-2xl bg-mustard-100 border border-mustard-400/40 text-mustard-700 text-[11px] font-semibold px-3 py-2 leading-snug">
                  <Phone size={11} className="inline mr-1" /> Recipient
                  requested a phone call for help.
                </p>
              )}
              {status === "verified" && confirmation?.confirmedAt && (
                <p className="text-[10px] text-charcoal-400">
                  Confirmed{" "}
                  {new Date(confirmation.confirmedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ============================= CUSTOMER VIEW ========================
  if (!isStaff) {
    const notRequested = status === "not_requested";
    const isFollowup = status === "needs_followup";
    return (
      <section
        className={`card-base p-4 mb-4 ${
          notRequested
            ? "bg-cream-100 border-charcoal-100"
            : "bg-mustard-100 border-mustard-400/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${
              notRequested
                ? "bg-white text-charcoal-700"
                : isFollowup
                ? "bg-white text-clay-600"
                : "bg-white text-mustard-700"
            }`}
          >
            {isFollowup ? (
              <AlertTriangle size={15} />
            ) : notRequested ? (
              <MapPin size={15} />
            ) : (
              <Send size={15} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[10px] uppercase tracking-eyebrow font-bold ${
                notRequested
                  ? "text-charcoal-400"
                  : isFollowup
                  ? "text-clay-600"
                  : "text-mustard-700"
              }`}
            >
              {isFollowup
                ? "Following up"
                : notRequested
                ? "Delivery location"
                : "Confirming location"}
            </p>
            <p className="text-sm font-semibold text-charcoal-900 mt-0.5">
              {isFollowup
                ? `Our team is reaching out to ${recipient.fullName.split(" ")[0]}`
                : notRequested
                ? `${recipient.address}, ${recipient.city}`
                : `We asked ${recipient.fullName.split(" ")[0]} to pin the exact spot`}
            </p>
            <p className="text-[11px] text-charcoal-700 mt-1 leading-snug">
              {isFollowup
                ? "We'll update you as soon as we've confirmed the drop-off point."
                : notRequested
                ? `KAYA will confirm the exact delivery spot with ${recipient.fullName.split(" ")[0]} before we set off.`
                : "You'll get a notification the moment the location is confirmed."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ============================= STAFF VIEW ==========================
  const bgClass =
    status === "needs_followup"
      ? "bg-clay-400/10 border-clay-400/40"
      : "bg-mustard-100 border-mustard-400/50";

  const handleCreateLink = async () => {
    setCreating(true);
    try {
      const lc = await ensureLocationConfirmation(order);
      if (lc) toast.success("Confirmation link ready");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className={`card-base p-5 mb-4 ${bgClass}`}>
      <div className="flex items-start gap-3">
        <span
          className={`grid place-items-center w-11 h-11 rounded-2xl shrink-0 shadow-soft ${
            status === "needs_followup"
              ? "bg-clay-400 text-cream-50"
              : "bg-mustard-400 text-charcoal-900"
          }`}
        >
          {status === "needs_followup" ? (
            <AlertTriangle size={18} />
          ) : (
            <Navigation2 size={18} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className={`text-[10px] uppercase tracking-eyebrow font-bold ${
              status === "needs_followup"
                ? "text-clay-600"
                : "text-mustard-700"
            }`}
          >
            Recipient location ·{" "}
            {status === "needs_followup"
              ? "needs follow-up"
              : status === "pending"
              ? "pending"
              : "not requested"}
          </p>
          <h3 className="display text-lg font-semibold text-charcoal-900 leading-tight mt-0.5">
            {status === "not_requested"
              ? `Send ${recipient.fullName.split(" ")[0]} a location request`
              : status === "needs_followup"
              ? `Follow up with ${recipient.fullName.split(" ")[0]}`
              : `Waiting on ${recipient.fullName.split(" ")[0]}`}
          </h3>
          <p className="text-xs text-charcoal-700 mt-1 leading-snug">
            {status === "not_requested"
              ? "Create a link, send it via WhatsApp or SMS, and the recipient will pin their exact address on their phone."
              : status === "needs_followup"
              ? confirmation?.followupNote ||
                "Recipient hasn't been able to confirm their location. Reach out directly."
              : confirmation?.notifiedAt
              ? `Last sent ${new Date(
                  confirmation.notifiedAt
                ).toLocaleString()} — resend if you haven't heard back.`
              : "Link is ready to send — pick a channel below."}
          </p>

          {/* Contact info */}
          <div className="mt-3 space-y-1.5 text-xs">
            <p className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
              Contact info
            </p>
            <a
              href={`tel:${recipient.phone}`}
              className="inline-flex items-center gap-1.5 font-semibold text-charcoal-900 hover:underline"
            >
              <Phone size={12} /> {recipient.phone}
            </a>
            <p className="text-charcoal-700">
              <span className="text-charcoal-400">Town / Area:</span>{" "}
              {recipient.townArea ?? recipient.city}
            </p>
            {recipient.closestLandmark && (
              <p className="text-charcoal-700">
                <span className="text-charcoal-400">Landmark:</span>{" "}
                {recipient.closestLandmark}
              </p>
            )}
            {recipient.deliveryNotes && (
              <p className="text-charcoal-700">
                <span className="text-charcoal-400">Sender's notes:</span>{" "}
                {recipient.deliveryNotes}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {status === "not_requested" ? (
              <button
                type="button"
                onClick={handleCreateLink}
                disabled={creating}
                className="btn-primary col-span-full text-xs py-2.5"
              >
                {creating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Creating
                    link…
                  </>
                ) : (
                  <>
                    <Send size={13} /> Create confirmation link
                  </>
                )}
              </button>
            ) : (
              <>
                <a
                  href={buildWhatsAppLink(recipient.phone, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    markLocationConfirmationNotified(confirmation!.id)
                  }
                  className="btn-emerald text-xs py-2.5"
                >
                  <MessageCircle size={13} /> Send via WhatsApp
                </a>
                <a
                  href={buildSmsLink(recipient.phone, message)}
                  onClick={() =>
                    markLocationConfirmationNotified(confirmation!.id)
                  }
                  className="btn-outline text-xs py-2.5"
                >
                  <Phone size={13} /> Send via SMS
                </a>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(confirmationUrl, "Confirmation link")
                  }
                  className="btn-outline text-xs py-2.5"
                >
                  <ClipboardCopy size={13} /> Copy link
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(message, "Message")}
                  className="btn-outline text-xs py-2.5"
                >
                  <ClipboardCopy size={13} /> Copy full message
                </button>
                {status === "needs_followup" ? (
                  <button
                    type="button"
                    onClick={() =>
                      resolveLocationConfirmationFollowup(confirmation!.id)
                    }
                    className="btn-ghost text-xs py-2.5 col-span-full text-emerald-700"
                  >
                    <Check size={13} /> Clear follow-up flag
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFollowupOpen((o) => !o)}
                    className="btn-ghost text-xs py-2.5 col-span-full text-clay-600"
                  >
                    <AlertTriangle size={13} /> Flag for follow-up
                  </button>
                )}
              </>
            )}
          </div>

          {followupOpen && confirmation && (
            <div className="mt-3 rounded-2xl bg-white border border-charcoal-100 p-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400 block mb-1">
                  Follow-up note (optional)
                </span>
                <textarea
                  value={followupNote}
                  onChange={(e) =>
                    setFollowupNote(e.target.value.slice(0, 200))
                  }
                  placeholder="e.g. Phone off, tried WhatsApp twice."
                  className="input-base min-h-[64px] resize-none text-xs"
                  rows={2}
                  maxLength={200}
                />
              </label>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    flagLocationConfirmationForFollowup(
                      confirmation.id,
                      followupNote.trim()
                    );
                    setFollowupOpen(false);
                    setFollowupNote("");
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-clay-400 hover:bg-clay-600 text-cream-50 text-xs font-bold py-2 transition"
                >
                  <AlertTriangle size={12} /> Flag for follow-up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFollowupOpen(false);
                    setFollowupNote("");
                  }}
                  className="btn-outline text-xs py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
