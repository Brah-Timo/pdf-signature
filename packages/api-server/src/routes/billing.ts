/**
 * API Server — Billing Routes
 *
 * POST /v1/billing/checkout     — Create Stripe Checkout session
 * POST /v1/billing/portal       — Create Customer Portal session
 * GET  /v1/billing/subscription — Get current subscription status
 * GET  /v1/billing/quota        — Get current usage and quota
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { prisma } from "../db/client.js";
import { getQuotaStatus, PLANS } from "../middleware/quota.js";

export async function billingRoute(fastify: FastifyInstance): Promise<void> {
  const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!, {
    apiVersion: "2023-10-16",
  });

  // ── POST /v1/billing/checkout — Start Pro upgrade ─────────────────────────
  fastify.post<{ Body: { plan: "PRO" | "TEAM"; successUrl: string; cancelUrl: string } }>(
    "/billing/checkout",
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;
      const { plan, successUrl, cancelUrl } = request.body ?? {};

      if (!plan || !["PRO", "TEAM"].includes(plan)) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Plan must be 'PRO' or 'TEAM'",
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Create or retrieve Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name ?? user.email,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;

        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId },
        });
      }

      const priceId =
        plan === "PRO"
          ? process.env["STRIPE_PRO_PRICE_ID"]!
          : process.env["STRIPE_TEAM_PRICE_ID"]!;

      // Create Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url:
          successUrl ?? `${process.env["DASHBOARD_URL"]}/billing?success=1`,
        cancel_url:
          cancelUrl ?? `${process.env["DASHBOARD_URL"]}/billing?cancelled=1`,
        allow_promotion_codes: true,
        metadata: { userId, plan },
        subscription_data: {
          trial_period_days: 0,
          metadata: { userId, plan },
        },
      });

      return reply.send({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    }
  );

  // ── POST /v1/billing/portal — Customer portal (manage subscription) ───────
  fastify.post<{ Body: { returnUrl?: string } }>(
    "/billing/portal",
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!user?.stripeCustomerId) {
        return reply.status(400).send({
          statusCode: 400,
          error: "No Subscription",
          message: "No active subscription found. Subscribe first to manage billing.",
          upgradeUrl: `${process.env["DASHBOARD_URL"]}/billing`,
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: request.body?.returnUrl ?? process.env["DASHBOARD_URL"],
      });

      return reply.send({ portalUrl: session.url });
    }
  );

  // ── GET /v1/billing/subscription — Get subscription details ──────────────
  fastify.get("/billing/subscription", async (request: FastifyRequest, reply) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;
    const userPlan = (request as FastifyRequest & { userPlan: string }).userPlan as "FREE" | "PRO" | "TEAM";

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        stripeCustomerId: true,
        monthlyCount: true,
        monthlyReset: true,
      },
    });

    if (!user) return reply.status(404).send({ error: "User not found" });

    const planInfo = PLANS[userPlan] ?? PLANS.FREE;
    const quota = await getQuotaStatus(userId, userPlan);

    let stripeSubscription: Stripe.Subscription | null = null;
    if (user.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      });
      stripeSubscription = subs.data[0] ?? null;
    }

    return reply.send({
      plan: user.plan,
      planDetails: {
        name: planInfo.name,
        price: planInfo.price,
        features: planInfo.features,
      },
      quota,
      subscription: stripeSubscription
        ? {
            id: stripeSubscription.id,
            status: stripeSubscription.status,
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000
            ).toISOString(),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          }
        : null,
    });
  });

  // ── GET /v1/billing/quota — Quick quota check ─────────────────────────────
  fastify.get("/billing/quota", async (request: FastifyRequest, reply) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;
    const userPlan = (request as FastifyRequest & { userPlan: string }).userPlan;

    const quota = await getQuotaStatus(userId, userPlan);

    return reply.send({
      ...quota,
      plan: userPlan,
      upgradeUrl: userPlan === "FREE"
        ? "https://pdf-signature.dev/pricing"
        : null,
    });
  });
}
