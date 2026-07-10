import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type SubstitutionEvent =
  | "substituted"
  | "removed"
  | "approval_pending"
  | "approved"
  | "rejected";

interface RequestBody {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  recipientName: string;
  originalProductName: string;
  originalQuantity: number;
  replacementProductName?: string;
  replacementQuantity?: number;
  event: SubstitutionEvent;
  reason?: string;
  orderUrl?: string;
  // Scheduled delivery snapshot — reinforces what the customer
  // picked at checkout so substitution emails clearly tie back to
  // the original delivery slot they're affecting.
  scheduledDateLabel?: string;
  scheduledWindowLabel?: string;
  scheduledWindowRange?: string;
  recipientAvailability?: "available" | "contact_first";
  specialInstructions?: string;
}

/**
 * Sends a branded substitution notice to the customer via Resend. Mirrors
 * send-refund-receipt: non-blocking, graceful degradation when
 * RESEND_API_KEY isn't configured. Five flavours cover the full
 * substitution lifecycle:
 *   - substituted        Ops swapped a sold-out item.
 *   - removed            Ops dropped a sold-out item.
 *   - approval_pending   Ops needs customer approval (high-value or
 *                        contact-first preference).
 *   - approved           Customer accepted the proposed swap.
 *   - rejected           Customer declined — item removed.
 *
 * Every flavour now embeds a "Scheduled delivery" sage card so the
 * customer instantly sees which delivery slot the change affects.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const {
      customerEmail,
      customerName,
      orderNumber,
      recipientName,
      originalProductName,
      originalQuantity,
      replacementProductName,
      replacementQuantity,
      event,
      reason,
      orderUrl,
      scheduledDateLabel,
      scheduledWindowLabel,
      scheduledWindowRange,
      recipientAvailability,
      specialInstructions,
    } = body;

    if (!customerEmail || !customerEmail.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid customerEmail is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.warn(
        "RESEND_API_KEY not configured — skipping substitution email"
      );
      return new Response(
        JSON.stringify({
          sent: false,
          reason: "Email service not configured. Set RESEND_API_KEY.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const { subject, html } = buildEmail({
      customerName,
      orderNumber,
      recipientName,
      originalProductName,
      originalQuantity,
      replacementProductName,
      replacementQuantity,
      event,
      reason,
      orderUrl,
      scheduledDateLabel,
      scheduledWindowLabel,
      scheduledWindowRange,
      recipientAvailability,
      specialInstructions,
    });

    const fromAddress =
      Deno.env.get("RESEND_FROM_EMAIL") ?? "KAYA <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [customerEmail],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Resend API error:", response.status, errorBody);
      return new Response(
        JSON.stringify({
          sent: false,
          reason: `Resend: ${response.status} ${errorBody.slice(0, 200)}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200, // never block the substitution flow
        }
      );
    }

    const result = await response.json();
    return new Response(
      JSON.stringify({ sent: true, emailId: result.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("send-substitution-receipt error:", error);
    const message = (error as Error).message ?? "Failed to send notice";
    return new Response(
      JSON.stringify({ sent: false, reason: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});

function buildEmail(data: {
  customerName: string;
  orderNumber: string;
  recipientName: string;
  originalProductName: string;
  originalQuantity: number;
  replacementProductName?: string;
  replacementQuantity?: number;
  event: SubstitutionEvent;
  reason?: string;
  orderUrl?: string;
  scheduledDateLabel?: string;
  scheduledWindowLabel?: string;
  scheduledWindowRange?: string;
  recipientAvailability?: "available" | "contact_first";
  specialInstructions?: string;
}): { subject: string; html: string } {
  const firstName = (data.customerName || "there").split(" ")[0];
  const originalLine = `${data.originalProductName} \u00d7 ${data.originalQuantity}`;
  const replacementLine = data.replacementProductName
    ? `${data.replacementProductName} \u00d7 ${
        data.replacementQuantity ?? data.originalQuantity
      }`
    : "";

  let subject = "";
  let heading = "";
  let subline = "";
  let actionRow = "";
  let cta = "View your order";

  switch (data.event) {
    case "substituted":
      subject = `Update to your KAYA order #${data.orderNumber}`;
      heading = `${data.originalProductName} was swapped for ${data.replacementProductName}`;
      subline = `Following your "allow similar substitutions" preference, our ops team replaced an unavailable item in ${data.recipientName}'s care package.`;
      actionRow = buildSwapRow(originalLine, replacementLine, "Substitution");
      break;
    case "removed":
      subject = `An item was removed from your KAYA order #${data.orderNumber}`;
      heading = `${data.originalProductName} was unavailable`;
      subline = `Following your "remove unavailable items" preference, we removed this line from ${data.recipientName}'s order and updated the total. The rest is on its way.`;
      actionRow = buildRemovedRow(originalLine, "Removed");
      break;
    case "approval_pending":
      subject = `Action needed on your KAYA order #${data.orderNumber}`;
      heading = "We need your approval to continue";
      subline = data.replacementProductName
        ? `${data.originalProductName} is unavailable for ${data.recipientName}'s order. We propose replacing it with ${data.replacementProductName} \u2014 please review.`
        : `${data.originalProductName} is unavailable for ${data.recipientName}'s order. Please tell us how to proceed.`;
      actionRow = data.replacementProductName
        ? buildSwapRow(originalLine, replacementLine, "Proposed swap")
        : buildRemovedRow(originalLine, "Unavailable");
      cta = "Review and approve";
      break;
    case "approved":
      subject = `Substitution applied to your KAYA order #${data.orderNumber}`;
      heading = "Thanks \u2014 substitution applied";
      subline = `${data.recipientName}'s order will now include ${data.replacementProductName} instead of ${data.originalProductName}. Your total has been updated.`;
      actionRow = buildSwapRow(originalLine, replacementLine, "Substitution");
      break;
    case "rejected":
      subject = `Item removed from your KAYA order #${data.orderNumber}`;
      heading = "Got it \u2014 the item has been removed";
      subline = `${data.originalProductName} has been removed from ${data.recipientName}'s order at your request. The rest of the care package is being prepared.`;
      actionRow = buildRemovedRow(originalLine, "Removed");
      break;
  }

  const reasonBlock = data.reason
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FFFBEB;border:1px solid #FCE7A7;border-radius:16px;margin:0 0 24px;">
        <tr><td style="padding:16px 20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#A8870F;margin:0 0 6px;">Reason from ops</div>
          <p style="font-size:14px;line-height:1.5;color:#1A1A1A;margin:0;">${escapeHtml(data.reason)}</p>
        </td></tr>
      </table>`
    : "";

  const scheduleBlock = buildScheduleBlock(data);

  const ctaBlock = data.orderUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
        <tr><td align="center">
          <a href="${data.orderUrl}" style="display:inline-block;background:#F2B705;color:#1A1A1A;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:14px;font-size:15px;">${escapeHtml(cta)}</a>
        </td></tr>
      </table>`
    : "";

  const tagLabel: Record<SubstitutionEvent, string> = {
    substituted: "Substitution made",
    removed: "Item removed",
    approval_pending: "Approval needed",
    approved: "Substitution approved",
    rejected: "Item removed",
  };

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#FAF6EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6EE;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 6px 32px rgba(26,26,26,0.06);">
      <tr><td style="background:#1A1A1A;padding:24px 32px;">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td>
            <div style="display:inline-block;background:#F2B705;color:#1A1A1A;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-weight:700;font-size:18px;font-family:Georgia,serif;">K</div>
            <span style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#FAF6EE;margin-left:10px;vertical-align:middle;">KAYA</span>
          </td>
          <td align="right" style="color:#F2B705;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">${tagLabel[data.event]}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;line-height:1.25;margin:0 0 8px;color:#1A1A1A;">${escapeHtml(heading)}</h1>
        <p style="font-size:15px;line-height:1.6;color:#5C5C5C;margin:0 0 8px;">Hi ${escapeHtml(firstName)},</p>
        <p style="font-size:15px;line-height:1.6;color:#1A1A1A;margin:0 0 24px;">${escapeHtml(subline)}</p>
        ${actionRow}
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6EE;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:16px 20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#8C8C8C;margin:0 0 8px;">Order</div>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">Order #</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.orderNumber)}</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">For</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.recipientName)}</td></tr>
          </table>
        </td></tr></table>
        ${scheduleBlock}
        ${reasonBlock}
        ${ctaBlock}
        <p style="font-size:13px;line-height:1.6;color:#5C5C5C;margin:0;">Questions? Reply to this email or message us in the KAYA app.</p>
      </td></tr>
      <tr><td style="background:#FAF6EE;padding:20px 32px;text-align:center;font-size:11px;color:#8C8C8C;letter-spacing:0.5px;">Sent with care by KAYA \u2014 supporting families across Ghana from anywhere in the world.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, html };
}

function buildSwapRow(
  original: string,
  replacement: string,
  label: string
): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6EE;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:20px 24px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#8C8C8C;margin:0 0 12px;">${escapeHtml(label)}</div>
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="45%" style="vertical-align:top;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#A33C2A;font-weight:700;margin:0 0 4px;">Was</div>
        <div style="font-size:14px;color:#1A1A1A;font-weight:600;line-height:1.4;">${escapeHtml(original)}</div>
      </td>
      <td width="10%" align="center" style="font-size:18px;color:#F2B705;font-weight:700;">\u2192</td>
      <td width="45%" style="vertical-align:top;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#5A8052;font-weight:700;margin:0 0 4px;">Now</div>
        <div style="font-size:14px;color:#1A1A1A;font-weight:600;line-height:1.4;">${escapeHtml(replacement)}</div>
      </td>
    </tr></table>
  </td></tr></table>`;
}

function buildRemovedRow(original: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6EE;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:20px 24px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#A33C2A;margin:0 0 8px;">${escapeHtml(label)}</div>
    <div style="font-size:15px;color:#1A1A1A;font-weight:600;line-height:1.4;">${escapeHtml(original)}</div>
  </td></tr></table>`;
}

/**
 * Reusable sage card that reminds the customer which scheduled delivery
 * slot the substitution is tied to. Renders nothing when no scheduled
 * delivery is attached (legacy orders or pre-schedule data).
 */
function buildScheduleBlock(data: {
  scheduledDateLabel?: string;
  scheduledWindowLabel?: string;
  scheduledWindowRange?: string;
  recipientAvailability?: "available" | "contact_first";
  specialInstructions?: string;
}): string {
  if (!data.scheduledDateLabel) return "";
  const availabilityNote =
    data.recipientAvailability === "contact_first"
      ? "Driver will call the recipient before delivery."
      : "Recipient will be available to receive at the address.";
  const instructionsLine = data.specialInstructions
    ? `<p style="margin:10px 0 0;padding:10px 12px;background:#FFFFFF;border-radius:10px;font-size:13px;line-height:1.5;color:#1A1A1A;font-style:italic;">\u201C${escapeHtml(data.specialInstructions)}\u201D</p>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#EFF7EE;border:1px solid #C9E2C5;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:18px 22px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#3E6E37;margin:0 0 10px;">Scheduled delivery</div>
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding:3px 0;font-size:14px;color:#5C5C5C;width:40%;">Date</td><td align="right" style="padding:3px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.scheduledDateLabel)}</td></tr>
      ${data.scheduledWindowLabel ? `<tr><td style="padding:3px 0;font-size:14px;color:#5C5C5C;">Window</td><td align="right" style="padding:3px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.scheduledWindowLabel)}</td></tr>` : ""}
      ${data.scheduledWindowRange ? `<tr><td style="padding:3px 0;font-size:14px;color:#5C5C5C;">Time</td><td align="right" style="padding:3px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.scheduledWindowRange)}</td></tr>` : ""}
    </table>
    <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#3E6E37;">\u2728 ${escapeHtml(availabilityNote)}</p>
    ${instructionsLine}
  </td></tr></table>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
