/**
 * API Server — Authentication Middleware
 *
 * Validates API keys on every request to /v1/* routes.
 * API keys are in the format: pdf_live_<32 hex> or pdf_test_<32 hex>
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client.js";
import { hashApiKey, safeCompare } from "@pdf-signature/crypto";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userPlan: "FREE" | "PRO" | "TEAM" | "ENTERPRISE";
    apiKeyId: string;
  }
}

/**
 * Extract and validate the Bearer API key from the Authorization header.
 * Attaches userId, userPlan, apiKeyId to the request object.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers["authorization"];

  // Allow API key via X-API-Key header as well
  const apiKeyHeader = request.headers["x-api-key"] as string | undefined;
  const rawKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : apiKeyHeader;

  if (!rawKey) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message:
        "Missing API key. Set Authorization: Bearer pdf_live_... or X-API-Key header. " +
        "Get your key at https://pdf-signature.dev",
    });
  }

  // Basic format validation before hitting the database
  if (!rawKey.startsWith("pdf_live_") && !rawKey.startsWith("pdf_test_")) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid API key format. Expected: pdf_live_... or pdf_test_...",
    });
  }

  // Hash the key for database lookup (we never store raw keys)
  const keyHash = hashApiKey(rawKey);

  // Look up the API key in the database
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: {
          id: true,
          plan: true,
          monthlyCount: true,
          monthlyReset: true,
          stripeCustomerId: true,
        },
      },
    },
  });

  if (!apiKey || !apiKey.isActive) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or revoked API key. Check your dashboard: https://app.pdf-signature.dev",
    });
  }

  // Attach user context to request
  request.userId = apiKey.user.id;
  request.userPlan = apiKey.user.plan;
  request.apiKeyId = apiKey.id;

  // Update last used timestamp (fire and forget — don't block request)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    })
    .catch(() => {
      // Non-fatal — log but don't fail the request
    });
}
