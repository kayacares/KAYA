import { supabase, trackWrite } from "@/lib/supabase";
import type {
  LocationConfirmation,
  LocationVerificationStatus,
} from "@/types";

/**
 * ============================================================
 * Recipient Location Confirmation data layer
 * ------------------------------------------------------------
 * Wraps CRUD against the shared `public.location_confirmations`
 * Supabase table. Each row represents one KAYA order's outstanding
 * "please pin your exact delivery location" request sent to the
 * recipient by WhatsApp / SMS.
 *
 * The public confirmation page (`/confirm-location/:token`)
 * reads and updates rows by their `token` field so the recipient
 * never has to sign in. RLS policies open the table to `anon`
 * reads / inserts / updates so this works today; when KAYA
 * migrates to authenticated ops sessions the token gate below
 * will still guarantee only the intended recipient can submit
 * a location for a given order.
 * ============================================================
 */

interface Row {
  id: string;
  order_id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_phone: string;
  token: string;
  verification_status: string;
  latitude: number | null;
  longitude: number | null;
  map_link: string | null;
  landmark: string | null;
  written_directions: string | null;
  request_call: boolean;
  confirmed_at: string | null;
  notified_at: string | null;
  followup_note: string | null;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: Row): LocationConfirmation => ({
  id: r.id,
  orderId: r.order_id,
  recipientId: r.recipient_id,
  recipientName: r.recipient_name,
  recipientPhone: r.recipient_phone,
  token: r.token,
  status:
    (r.verification_status as LocationVerificationStatus) ?? "pending",
  latitude: r.latitude ?? undefined,
  longitude: r.longitude ?? undefined,
  mapLink: r.map_link ?? undefined,
  landmark: r.landmark ?? undefined,
  writtenDirections: r.written_directions ?? undefined,
  requestCall: r.request_call ?? false,
  confirmedAt: r.confirmed_at ?? undefined,
  notifiedAt: r.notified_at ?? undefined,
  followupNote: r.followup_note ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRow = (c: LocationConfirmation) => ({
  id: c.id,
  order_id: c.orderId,
  recipient_id: c.recipientId,
  recipient_name: c.recipientName,
  recipient_phone: c.recipientPhone,
  token: c.token,
  verification_status: c.status,
  latitude: c.latitude ?? null,
  longitude: c.longitude ?? null,
  map_link: c.mapLink ?? null,
  landmark: c.landmark ?? null,
  written_directions: c.writtenDirections ?? null,
  request_call: c.requestCall,
  confirmed_at: c.confirmedAt ?? null,
  notified_at: c.notifiedAt ?? null,
  followup_note: c.followupNote ?? null,
});

export async function fetchLocationConfirmations(): Promise<
  LocationConfirmation[]
> {
  const { data, error } = await supabase
    .from("location_confirmations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function fetchLocationConfirmationByToken(
  token: string
): Promise<LocationConfirmation | null> {
  const { data, error } = await supabase
    .from("location_confirmations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fromRow(data as Row);
}

export async function upsertLocationConfirmation(
  c: LocationConfirmation
): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("location_confirmations")
      .upsert(toRow(c), { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
  });
}

export async function deleteLocationConfirmation(id: string): Promise<void> {
  await trackWrite(async () => {
    const { error } = await supabase
      .from("location_confirmations")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
}

/* ---------------------------------------------------------------- */
/*  Helpers                                                         */
/* ---------------------------------------------------------------- */

/**
 * 32-character URL-safe hex token generated with `crypto`. Long
 * enough that guessing valid confirmation links by scanning is
 * infeasible while still fitting on a WhatsApp preview line.
 */
export function generateConfirmationToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Google Maps preview URL for a coordinate pair. Rounded to 6dp
 * so we don't leak more precision than the GPS actually captured.
 */
export function buildMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * WhatsApp Click-to-Chat URL. Strips every non-digit from the
 * phone so numbers pasted with spaces / dashes / parentheses
 * still produce a well-formed `wa.me` link.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/**
 * `sms:` deep link with a pre-filled body. Some Android browsers
 * ignore the `body` query param — the Copy Message button on the
 * OrderDetail card is the fallback path there.
 */
export function buildSmsLink(phone: string, message: string): string {
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}

/**
 * Centralised copy for the confirmation request. Every channel
 * (WhatsApp, SMS, clipboard) always says the same thing so the
 * recipient's first touch feels consistent no matter how it
 * reached them.
 */
export function composeConfirmationMessage(
  recipientName: string,
  url: string
): string {
  const firstName = recipientName.split(" ")[0];
  return `Hi ${firstName}, someone has sent you a KAYA delivery. Please confirm your delivery location so we can get it to you smoothly.

Confirm Delivery Location: ${url}`;
}
