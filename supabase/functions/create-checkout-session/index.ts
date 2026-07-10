import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  amount: number;
  /**
   * Currency argument is retained for back-compat with any historical
   * client callers but ignored server-side — KAYA is Ghana-first and
   * every Stripe checkout is created in GHS so charges match the
   * price customers see in the app to the cedi.
   */
  currency?: string;
  customerEmail?: string;
  recipientName?: string;
  itemCount?: number;
  description?: string;
}

// KAYA charges every customer in Ghana Cedis. See src/lib/currency.ts
// for the wider rationale; the client-side note at checkout tells the
// customer their bank may convert the GHS charge into their local
// currency at the bank's own exchange rate.
const KAYA_STRIPE_CURRENCY = "ghs";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const {
      amount,
      customerEmail,
      recipientName,
      itemCount,
      description,
    } = body;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be a positive number" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    // Any incoming `currency` value is intentionally ignored — KAYA
    // charges in GHS end-to-end. The `amount` must be supplied in
    // pesewas (GHS minor units), i.e. GH₵1.00 = 100.
    const currency = KAYA_STRIPE_CURRENCY;

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

    const origin = req.headers.get("origin") ?? "";

    let customerId: string | undefined;
    if (customerEmail) {
      try {
        const existing = await stripe.customers.list({
          email: customerEmail,
          limit: 1,
        });
        if (existing.data.length > 0) {
          customerId = existing.data[0].id;
        }
      } catch (lookupErr) {
        console.warn("Stripe customer lookup failed:", lookupErr);
      }
    }

    const productName = recipientName
      ? `KAYA care package for ${recipientName}`
      : "KAYA care package";

    const itemDescription =
      description ||
      (itemCount
        ? `${itemCount} curated items · delivered in Ghana`
        : "Care delivered in Ghana");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            // Always GHS — see KAYA_STRIPE_CURRENCY above.
            currency,
            product_data: {
              name: productName,
              description: itemDescription,
            },
            unit_amount: Math.round(amount),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-canceled`,
      metadata: {
        recipient: recipientName ?? "",
        source: "kaya-checkout",
        // Explicit trail so finance can verify every KAYA charge
        // was booked in Ghana Cedis regardless of the caller.
        settlement_currency: currency,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Stripe create-checkout-session error:", error);
    const message = (error as Error).message ?? "Stripe checkout failed";
    return new Response(JSON.stringify({ error: `Stripe: ${message}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
