/**
 * @pdf-signature/api-server — Main Fastify Server
 *
 * Registers all plugins, middleware, and routes.
 * Serves as the entry point for the pdf-signature API.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import "dotenv/config";

import { signRoute } from "./routes/sign.js";
import { verifyRoute } from "./routes/verify.js";
import { webhookRoute } from "./routes/webhook.js";
import { billingRoute } from "./routes/billing.js";
import { authMiddleware } from "./middleware/auth.js";

// ─────────────────────────────────────────────
// Build Server
// ─────────────────────────────────────────────

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      transport: process.env["NODE_ENV"] !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
    trustProxy: true, // Required for correct IP behind load balancer
    requestTimeout: 30_000,
    bodyLimit: 50 * 1024 * 1024, // 50MB — allows large PDF uploads
  });

  // ── Security headers ─────────────────────────────────────────────────────
  await fastify.register(helmet, {
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  });

  // ── CORS ─────────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: [
      "https://app.pdf-signature.dev",
      "https://sign.pdf-signature.dev",
      ...(process.env["NODE_ENV"] !== "production"
        ? ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
        : []),
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Webhook-Signature"],
  });

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  await fastify.register(rateLimit, {
    global: true,
    max: parseInt(process.env["RATE_LIMIT_MAX_REQUESTS"] ?? "100"),
    timeWindow: parseInt(process.env["RATE_LIMIT_WINDOW_MS"] ?? "60000"),
    skipOnError: false,
    keyGenerator: (request) => {
      // Rate limit by API key first, then by IP
      const apiKey = request.headers["authorization"]?.replace("Bearer ", "");
      return apiKey ?? request.ip ?? "anonymous";
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Max ${context.max} requests per ${context.after}. Retry after ${context.ttl}ms.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  // ── Multipart (file uploads) ───────────────────────────────────────────────
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1024 * 1024,       // 1MB for form fields
      fileSize: 50 * 1024 * 1024,   // 50MB for PDF files
      files: 1,                      // Only 1 file per request
    },
  });

  // ── Health check ─────────────────────────────────────────────────────────
  fastify.get("/health", async (_request, reply) => {
    return reply.send({
      status: "ok",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  fastify.get("/", async (_request, reply) => {
    return reply.send({
      name: "pdf-signature API",
      version: "1.0.0",
      docs: "https://docs.pdf-signature.dev",
      status: "operational",
    });
  });

  // ── API v1 Routes ─────────────────────────────────────────────────────────
  await fastify.register(
    async (app) => {
      // All /v1/* routes require authentication
      app.addHook("preHandler", authMiddleware);

      await app.register(signRoute);
      await app.register(verifyRoute);
      await app.register(billingRoute);
    },
    { prefix: "/v1" }
  );

  // Webhook routes do NOT go through API key auth (they use Stripe's own sig)
  await fastify.register(webhookRoute, { prefix: "/v1" });

  // ── Global error handler ──────────────────────────────────────────────────
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    fastify.log.error({
      err: error,
      req: { method: request.method, url: request.url, ip: request.ip },
      statusCode,
    });

    // Don't expose internal error details in production
    const message =
      process.env["NODE_ENV"] === "production" && statusCode >= 500
        ? "Internal server error"
        : error.message;

    return reply.status(statusCode).send({
      statusCode,
      error: error.name ?? "Error",
      message,
      ...(process.env["NODE_ENV"] !== "production" && statusCode >= 500
        ? { stack: error.stack }
        : {}),
    });
  });

  // ── Not found handler ─────────────────────────────────────────────────────
  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return fastify;
}

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────

async function start() {
  const fastify = await buildServer();
  const port = parseInt(process.env["PORT"] ?? "8080");
  const host = process.env["HOST"] ?? "0.0.0.0";

  try {
    await fastify.listen({ port, host });
    fastify.log.info(`🚀 pdf-signature API running at http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Start only if this is the main module
if (require.main === module) {
  start();
}
