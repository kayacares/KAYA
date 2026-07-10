import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface OrderItemSummary {
  name: string;
  quantity: number;
}

interface RequestBody {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  recipientName: string;
  recipientCity?: string;
  totalAmount: number; // GHS
  currencyCode?: string;
  itemCount: number;
  itemSummary?: OrderItemSummary[];
  // Scheduled delivery snapshot — the headline value of this email.
  // When omitted (legacy / unscheduled orders) the schedule block is
  // silently skipped.
  scheduledDateLabel?: string;
  scheduledWindowLabel?: string;
  scheduledWindowRange?: string;
  recipientAvailability?: "available" | "contact_first";
  specialInstructions?: string;
  orderUrl?: string;
}

/**
 * Sends the first branded email the customer receives after placing an
 * order. Reinforces the scheduled delivery date, window label, range,
 * and recipient-availability preference they picked at checkout so the
 * "did I lock in the right slot?" anxiety is answered immediately.
 *
 * Mirrors the non-blocking pattern of send-refund-receipt and
 * send-substitution-receipt: if RESEND_API_KEY isn't configured we
 * degrade gracefully and never block createOrder.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body.customerEmail || !body.customerEmail.includes("@")) {
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
        "RESEND_API_KEY not configured — skipping order confirmation email"
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

    const { subject, html } = buildEmail(body);
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
        to: [body.customerEmail],
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
          status: 200, // never block order creation
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
    console.error("send-order-confirmation error:", error);
    const message = (error as Error).message ?? "Failed to send confirmation";
    return new Response(
      JSON.stringify({ sent: false, reason: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});

function buildEmail(data: RequestBody): { subject: string; html: string } {
  const firstName = (data.customerName || "there").split(" ")[0];
  const recipientFirst = (data.recipientName || "your loved one").split(" ")[0];
  const formattedTotal = `GH\u20B5 ${data.totalAmount.toFixed(2)}`;
  const itemCountLabel = `${data.itemCount} item${
    data.itemCount === 1 ? "" : "s"
  }`;
  const subject = `Your KAYA order #${data.orderNumber} is confirmed`;
  const heading = `Care is on the way to ${recipientFirst}`;

  const scheduleBlock = buildScheduleBlock(data);

  const summaryBlock = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6EE;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:20px 24px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#8C8C8C;margin:0 0 8px;">Order summary</div>
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">Order #</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.orderNumber)}</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">For</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.recipientName)}</td></tr>
      ${data.recipientCity ? `<tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">Delivering to</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.recipientCity)}</td></tr>` : ""}
      <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">Items</td><td align="right" style="padding:4px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(itemCountLabel)}</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#5C5C5C;">Total</td><td align="right" style="padding:4px 0;font-size:16px;color:#1A1A1A;font-weight:700;">${formattedTotal}</td></tr>
    </table>
  </td></tr></table>`;

  const itemListBlock = buildItemListBlock(
    data.itemSummary ?? [],
    data.itemCount
  );

  const ctaBlock = data.orderUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;"><tr><td align="center">
        <a href="${data.orderUrl}" style="display:inline-block;background:#F2B705;color:#1A1A1A;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:14px;font-size:15px;">Track your order</a>
      </td></tr></table>`
    : "";

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
          <td align="right" style="color:#F2B705;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Order confirmed</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:600;line-height:1.2;margin:0 0 8px;color:#1A1A1A;">${escapeHtml(heading)}</h1>
        <p style="font-size:15px;line-height:1.6;color:#5C5C5C;margin:0 0 8px;">Hi ${escapeHtml(firstName)},</p>
        <p style="font-size:15px;line-height:1.6;color:#1A1A1A;margin:0 0 24px;">Thanks for sending care through KAYA. Your order is locked in and we\u2019re getting it ready. Here are the details we\u2019ll keep on file for ${escapeHtml(recipientFirst)}:</p>
        ${scheduleBlock}
        ${summaryBlock}
        ${itemListBlock}
        ${ctaBlock}
        <p style="font-size:13px;line-height:1.6;color:#5C5C5C;margin:0;">Need to change something? Reply to this email or message us in the KAYA app within the next hour and we\u2019ll catch it before fulfilment starts.</p>
      </td></tr>
      <tr><td style="background:#FAF6EE;padding:20px 32px;text-align:center;font-size:11px;color:#8C8C8C;letter-spacing:0.5px;">Sent with care by KAYA \u2014 supporting families across Ghana from anywhere in the world.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, html };
}

/**
 * Headline schedule card — sage-tinted and rendered before the order
 * summary so the customer immediately confirms what they picked.
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
      ? "We\u2019ll call the recipient before the driver arrives."
      : "The recipient will be available to receive the delivery.";
  const instructionsLine = data.specialInstructions
    ? `<p style="margin:12px 0 0;padding:10px 12px;background:#FFFFFF;border-radius:10px;font-size:13px;line-height:1.5;color:#1A1A1A;font-style:italic;">\u201C${escapeHtml(data.specialInstructions)}\u201D</p>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#EFF7EE;border:1px solid #C9E2C5;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:20px 24px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#3E6E37;margin:0 0 12px;">Scheduled delivery</div>
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding:3px 0;font-size:14px;color:#5C5C5C;width:40%;">Date</td><td align="right" style="padding:3px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.scheduledDateLabel)}</td></tr>
      ${data.scheduledWindowLabel ? `<tr><td style="padding:3px 0;font-size:14px;color:#5C5C5C;">Window</td><td align="right" style="padding:3px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.scheduledWindowLabel)}</td></tr>` : ""}
      ${data.scheduledWindowRange ? `<tr><td style="padding:3px 0;font-size:14px;color:#5C5C5C;">Time</td><td align="right" style="padding:3px 0;font-size:14px;color:#1A1A1A;font-weight:600;">${escapeHtml(data.scheduledWindowRange)}</td></tr>` : ""}
    </table>
    <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#3E6E37;">\u2728 ${escapeHtml(availabilityNote)}</p>
    ${instructionsLine}
    <p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#5C5C5C;">We\u2019ll do our best to accommodate your request, but exact delivery times cannot be guaranteed.</p>
  </td></tr></table>`;
}

/**
 * Items list — surfaces up to 5 items with an overflow caption when
 * there are more. Hidden entirely when nothing is provided.
 */
function buildItemListBlock(
  items: OrderItemSummary[],
  totalItemCount: number
): string {
  if (!items.length) return "";
  const shown = items.slice(0, 5);
  const shownCount = shown.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const overflow = Math.max(0, totalItemCount - shownCount);
  const rows = shown
    .map(
      (i) =>
        `<div style="font-size:14px;color:#1A1A1A;line-height:1.5;padding:3px 0;"><strong style="color:#F2B705;">${escapeHtml(
          String(i.quantity ?? 1)
        )}\u00d7</strong> ${escapeHtml(i.name)}</div>`
    )
    .join("");
  const moreLine =
    overflow > 0
      ? `<div style="font-size:13px;color:#8C8C8C;line-height:1.5;padding:6px 0 0;font-style:italic;">\u2026and ${overflow} more in the basket</div>`
      : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6EE;border-radius:16px;margin:0 0 24px;"><tr><td style="padding:18px 22px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#8C8C8C;margin:0 0 10px;">What you\u2019re sending</div>
    ${rows}
    ${moreLine}
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
