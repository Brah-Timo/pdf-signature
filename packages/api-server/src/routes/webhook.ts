/**
 * API Server — Webhook Routes
 *
 * POST /v1/webhooks/stripe — Receive Stripe billing events
 *
 * Note: Customer-facing webhooks (signature.completed, etc.) are SENT
 * by the notifyService, not received here. This file handles INCOMING
 * webhooks from third-party services (Stripe).
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { prisma } from "../db/client.js";

export async function webhookRoute(fastify: FastifyInstance): Promise<void> {

  // ── POST /v1/webhooks/stripe — Stripe billing events ─────────────────────
  fastify.post(
    "/webhooks/stripe",
    {
      config: { skipAuth: true, rawBody: true },
    },
    async (request: FastifyRequest, reply) => {
      const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!, {
        apiVersion: "2023-10-16",
      });

      const sig = request.headers["stripe-signature"] as string;
      const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"]!;

      if (!sig) {
        return reply.status(400).send({ error: "Missing stripe-signature header" });
      }

      let event: Stripe.Event;
      try {
        // Verify Stripe signature using the raw body
        const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody
          ?? Buffer.from(JSON.stringify(request.body));

        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (error) {
        fastify.log.warn({ msg: "Stripe webhook signature verification failed", error });
        return reply.status(400).send({ error: "Webhook signature invalid" });
      }

      fastify.log.info({ msg: "Stripe event received", type: event.type });

      // Handle events
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionChange(subscription);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionCancelled(subscription);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          fastify.log.info({ msg: "Payment succeeded", invoiceId: invoice.id });
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          await handlePaymentFailed(invoice);
          break;
        }

        default:
          fastify.log.debug({ msg: "Unhandled Stripe event", type: event.type });
      }

      return reply.status(200).send({ received: true });
    }
  );
}

// ─────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────

async function handleSubscriptionChange(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price.id;

  // Determine plan from price ID
  let plan: "FREE" | "PRO" | "TEAM" = "FREE";
  if (priceId === process.env["STRIPE_PRO_PRICE_ID"]) plan = "PRO";
  else if (priceId === process.env["STRIPE_TEAM_PRICE_ID"]) plan = "TEAM";

  // Only upgrade if subscription is active
  if (status === "active" || status === "trialing") {
    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { plan },
    });
  }
}

async function handleSubscriptionCancelled(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { plan: "FREE" },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  // Log payment failure — don't immediately downgrade
  // (Stripe handles retries and grace period)
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    console.warn(
      `Payment failed for user ${user.id} (${user.email}). Invoice: ${invoice.id}`
    );
  }
}
