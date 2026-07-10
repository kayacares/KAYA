import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  recipientName: string;
  refundAmount: number; // GHS
  totalAmount: number; // GHS
  reason?: string;
  isPartial: boolean;
  orderUrl?: string;
  currencyCode?: string;
  // Scheduled delivery snapshot — surfaced as a sage reminder card so
  // refund emails clearly tie back to the original delivery slot the
  // customer picked at checkout.
  scheduledDateLabel?: string;
  scheduledWindowLabel?: string;
  scheduledWindowRange?: string;
  recipientAvailability?: "available" | "contact_first";
  specialInstructions?: string;
}

/**
 * Sends a branded refund receipt to the customer via Resend. The function
 * is intentionally non-blocking: when RESEND_API_KEY is missing or
 * Resend errors, we log and return 200 with {sent:false} so the parent
 * refund flow still succeeds. Configure RESEND_API_KEY (and optionally
 * RESEND_FROM_EMAIL) in OnSpace Cloud → Secrets to enable real email.
 *
 * The refund email now embeds the scheduled delivery slot so the
 * customer knows exactly which delivery the refund relates to.
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
      refundAmount,
      totalAmount,
      reason,
      isPartial,
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
        "RESEND_API_KEY not configured — skipping refund receipt email"
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

    const formattedRefund = `GH\u20B5 ${refundAmount.toFixed(2)}`;
    const formattedTotal = `GH\u20B5 ${totalAmount.toFixed(2)}`;
    const subject = `Refund of ${formattedRefund} processed for KAYA order #${orderNumber}`;
    const html = buildReceiptHtml({
      customerName,
      orderNumber,
      recipientName,
      refundAmount: formattedRefund,
      totalAmount: formattedTotal,
      reason,
      isPartial,
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
          status: 200, // never block the refund flow
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
    console.error("send-refund-receipt error:", error);
    const message = (error as Error).message ?? "Failed to send receipt";
    return new Response(
      JSON.stringify({ sent: false, reason: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});

function buildReceiptHtml(data: {
  customerName: string;
  orderNumber: string;
  recipientName: string;
  refundAmount: string;
  totalAmount: string;
  reason?: string;
  isPartial: boolean;
  orderUrl?: string;
  scheduledDateLabel?: string;
  scheduledWindowLabel?: string;
  scheduledWindowRange?: string;
  recipientAvailability?: "available" | "contact_first";
  specialInstructions?: string;
}): string {
  const firstName = (data.customerName || "there").split(" ")[0];
  const heading = data.isPartial
    ? `Your partial refund of ${data.refundAmount} is on its way`
    : `Your refund of ${data.refundAmount} is on its way`;
  const subline = data.isPartial
    ? `We\u2019ve issued ${data.refundAmount} of your ${data.totalAmount} order.`
    : `We\u2019ve issued a full refund of ${data.refundAmount}.`;

  const reasonBlock = data.reason
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FFFBEB;border:1px solid #FCE7A7;border-radius:16px;margin:0 0 24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#A8870F;margin:0 0 6px;">Reason</div>
        <p style="font-size:14px;line-height:1.5;color:#1A1A1A;margin:0;">${escapeHtml(data.reason)}</p>
      </td></tr>
    </table>`
    : "";

  const scheduleBlock = buildScheduleBlock(data);

  const ctaBlock = data.orderUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="${data.orderUrl}" style="display:inline-block;background:#F2B705;color:#1A1A1A;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:14px;font-size:15px;">View order</a>
      </td></tr>
    </table>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Refund processed - KAYA</title></head>
<body style="margin:0;padding:0;background:#FAF6EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6EE;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 6px 32px rgba(26,26,26,0.06);">
      <tr><td style="background:#1A1A1A;padding:24px 32px;">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td>
            <div style="display:inline-block;background:#F2B705;color:#1A1A1A;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-weight:700;font-size:18px;font-family:Georgia,serif;">K</div>
            <span style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#FAF6EE;margin-left:10px;vertical-align:middle;">KAYA</span>
          </td>
          <td align="right" style="color:#F2B705;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Refund receipt</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:600;line-height:1.2;margin:0 0 8px;color:#1A1A1A;">${heading}</h1>
        <p style="font-size:15px;line-height:1.6;color:#5C5C5C;margin:0 0 24px;">Hi ${escapeHtml(firstName)},</p>
        <p style="font-size:15px;line-height:1.6;color:#1A1A1A;margin:0 0 24px;">${subline} Funds typically reach your account within <strong>5\u201310 business days</strong>, depending on your bank or card provider.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6EE;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:20px 24px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#8C8C8C;margin:0 0 8px;">Refund details</div>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">Order</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">#${escapeHtml(data.orderNumber)}</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">For</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.recipientName)}</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">Order total</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${data.totalAmount}</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">Refunded</td><td align="right" style="padding:4px 0;font-size:16px;color:#1A1A1A;font-weight:700;">${data.refundAmount}</td></tr>
          </table>
        </td></tr></table>
        ${scheduleBlock}
        ${reasonBlock}
        ${ctaBlock}
        <p style="font-size:13px;line-height:1.6;color:#5C5C5C;margin:0;">Questions about this refund? Reply to this email or message us in the KAYA app.</p>
      </td></tr>
      <tr><td style="background:#FAF6EE;padding:20px 32px;text-align:center;font-size:11px;color:#8C8C8C;letter-spacing:0.5px;">Sent with care by KAYA \u2014 supporting families across Ghana from anywhere in the world.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/**
 * Reusable sage card that reminds the customer which scheduled delivery
 * slot the refund relates to. Renders nothing when no scheduled
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
      ? "Driver was set to call the recipient before delivery."
      : "Recipient was set to receive at the address.";
  const instructionsLine = data.specialInstructions
    ? `<p style="margin:10px 0 0;padding:10px 12px;background:#FFFFFF;border-radius:10px;font-size:13px;line-height:1.5;color:#1A1A1A;font-style:italic;">\u201C${escapeHtml(data.specialInstructions)}\u201D</p>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#EFF7EE;border:1px solid #C9E2C5;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:18px 22px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#3E6E37;margin:0 0 10px;">Originally scheduled for</div>
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
