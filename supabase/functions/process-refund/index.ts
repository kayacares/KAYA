import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  paymentIntentId: string;
  amount?: number; // minor units (cents). Omit for full refund.
  currency?: string;
  reason?: string;
  orderId?: string;
}

/**
 * Processes a Stripe refund for a given PaymentIntent. Called by the
 * AppContext refundOrder method only when the order has a stored
 * stripePaymentIntentId. Returns the Stripe refund id + status so the
 * frontend can persist them on the order record + audit log.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { paymentIntentId, amount, reason, orderId } = body;

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: "paymentIntentId is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Stripe: secret key not configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: {
        orderId: orderId ?? "",
        internalReason: (reason ?? "").slice(0, 480),
      },
    };

    if (amount && amount > 0) {
      refundParams.amount = amount;
    }

    const refund = await stripe.refunds.create(refundParams);

    return new Response(
      JSON.stringify({
        refundId: refund.id,
        status: refund.status,
        amountRefundedMinor: refund.amount,
        currency: refund.currency,
        paymentIntent: refund.payment_intent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Stripe process-refund error:", error);
    const message = (error as Error).message ?? "Refund failed";
    const status = (error as { statusCode?: number })?.statusCode ?? 500;
    return new Response(JSON.stringify({ error: `Stripe: ${message}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
