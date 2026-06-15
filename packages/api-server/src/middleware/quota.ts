/**
 * API Server — Quota Middleware
 *
 * Enforces the monthly signature quota for FREE plan users (20/month).
 * PRO and TEAM plan users have unlimited signatures.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client.js";

// Plan quotas
export const PLAN_QUOTAS = {
  FREE: 20,
  PRO: Infinity,
  TEAM: Infinity,
  ENTERPRISE: Infinity,
} as const;

// Plan features
export const PLANS = {
  FREE: {
    name: "Free",
    monthlySignatures: 20,
    price: 0,
    features: [
      "20 signatures/month",
      "Draw, type, or upload signature",
      "eIDAS & KSA-ETL compliance",
      "Audit trail",
      "Email notification to signer",
      "30-day document storage",
    ],
  },
  PRO: {
    name: "Pro",
    monthlySignatures: Infinity,
    price: 22,
    stripePriceId: process.env["STRIPE_PRO_PRICE_ID"] ?? "",
    features: [
      "Unlimited signatures",
      "Everything in Free",
      "Multi-party sequential signing",
      "Webhook notifications",
      "Branded signing page (your logo)",
      "Audit trail PDF export",
      "5-year document storage",
      "SMS notifications",
      "Analytics dashboard",
      "Priority email support (< 24h)",
      "No rate limits",
    ],
  },
  TEAM: {
    name: "Team",
    monthlySignatures: Infinity,
    price: 99,
    stripePriceId: process.env["STRIPE_TEAM_PRICE_ID"] ?? "",
    features: [
      "Everything in Pro",
      "Up to 10 team members",
      "Template library",
      "Bulk signing",
      "SSO / SAML",
      "Dedicated support",
      "99.9% SLA",
    ],
  },
} as const;

/**
 * Check if the user has remaining quota and increment the counter.
 * Call this BEFORE starting the signing process.
 *
 * @throws QuotaExceededError (HTTP 402) if limit is reached
 */
export async function checkAndIncrementQuota(
  userId: string,
  plan: "FREE" | "PRO" | "TEAM" | "ENTERPRISE"
): Promise<void> {
  // PRO and above have unlimited signatures
  if (plan !== "FREE") return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { monthlyCount: true, monthlyReset: true },
  });

  if (!user) throw new Error("User not found");

  const now = new Date();

  // Reset monthly counter if the reset date has passed
  if (now > user.monthlyReset) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyCount: 1, // Start at 1 (counting this request)
        monthlyReset: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    });
    return;
  }

  // Check against FREE plan quota
  if (user.monthlyCount >= PLAN_QUOTAS.FREE) {
    throw {
      statusCode: 402,
      code: "QUOTA_EXCEEDED",
      error: "Payment Required",
      message:
        `Monthly free quota (${PLAN_QUOTAS.FREE} signatures) exceeded. ` +
        `Upgrade to Pro for unlimited signatures at $22/month: https://pdf-signature.dev/pricing`,
      currentUsage: user.monthlyCount,
      limit: PLAN_QUOTAS.FREE,
      upgradeUrl: "https://pdf-signature.dev/pricing",
    };
  }

  // Increment counter atomically
  await prisma.user.update({
    where: { id: userId },
    data: { monthlyCount: { increment: 1 } },
  });
}

/**
 * Express-style Fastify hook to check quota before signing routes.
 * Attach to specific routes with addHook('preHandler', quotaHook).
 */
export async function quotaHook(
  request: FastifyRequest & { userId: string; userPlan: "FREE" | "PRO" | "TEAM" | "ENTERPRISE" },
  reply: FastifyReply
): Promise<void> {
  try {
    await checkAndIncrementQuota(request.userId, request.userPlan);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string; upgradeUrl?: string; code?: string };
    if (err.statusCode === 402) {
      return reply.status(402).send(error);
    }
    throw error;
  }
}

/**
 * Get the current quota status for a user.
 */
export async function getQuotaStatus(userId: string, plan: string): Promise<{
  used: number;
  limit: number | "unlimited";
  resetDate: Date;
  percentUsed: number;
}> {
  if (plan !== "FREE") {
    return {
      used: 0,
      limit: "unlimited",
      resetDate: new Date(),
      percentUsed: 0,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { monthlyCount: true, monthlyReset: true },
  });

  const used = user?.monthlyCount ?? 0;
  const limit = PLAN_QUOTAS.FREE;

  return {
    used,
    limit,
    resetDate: user?.monthlyReset ?? new Date(),
    percentUsed: Math.min(100, (used / limit) * 100),
  };
}
