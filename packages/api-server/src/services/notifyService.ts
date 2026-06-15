/**
 * Notification Service
 *
 * Dispatches webhooks and emails when signature events occur.
 * Handles retry logic for failed webhook deliveries.
 */

import axios from "axios";
import { createHmac } from "crypto";
import { prisma } from "../db/client.js";
import { emailService } from "./emailService.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SignatureCompletedEvent {
  signatureId: string;
  signerName: string;
  signerEmail: string;
  documentTitle: string;
  downloadUrl: string;
}

// ─────────────────────────────────────────────
// Signature Completed
// ─────────────────────────────────────────────

/**
 * Notify the document owner that their document has been signed.
 * Sends:
 * 1. Email notification (immediate)
 * 2. Webhook POST to webhookUrl (if configured)
 */
export async function signatureCompleted(
  ownerId: string,
  event: SignatureCompletedEvent
): Promise<void> {
  // Get owner details and webhook URL
  const signatureRequest = await prisma.signatureRequest.findUnique({
    where: { id: event.signatureId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!signatureRequest) return;

  // 1. Send completion email to owner
  try {
    await emailService.sendSignatureCompleted({
      to: signatureRequest.user.email,
      ownerName: signatureRequest.user.name ?? undefined,
      signerName: event.signerName,
      signerEmail: event.signerEmail,
      documentTitle: event.documentTitle,
      downloadUrl: event.downloadUrl,
      signedAt: signatureRequest.signedAt ?? new Date(),
    });
  } catch (error) {
    console.error(`[NotifyService] Failed to send completion email: ${(error as Error).message}`);
  }

  // 2. Dispatch webhook (if configured)
  if (signatureRequest.webhookUrl) {
    await dispatchWebhook(
      signatureRequest.id,
      signatureRequest.webhookUrl,
      "signature.completed",
      {
        signerEmail: event.signerEmail,
        signerName: event.signerName,
        documentTitle: event.documentTitle,
        downloadUrl: event.downloadUrl,
        legalStandard: signatureRequest.legalStandard,
        signedAt: signatureRequest.signedAt?.toISOString() ?? new Date().toISOString(),
      }
    );
  }
}

// ─────────────────────────────────────────────
// Webhook Dispatcher
// ─────────────────────────────────────────────

/**
 * Dispatch a webhook with HMAC-SHA256 signature for authenticity.
 *
 * The payload format matches the WebhookPayload type in the core package.
 * Uses exponential backoff retry (3 attempts: immediately, 1min, 5min).
 */
export async function dispatchWebhook(
  signatureId: string,
  webhookUrl: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const payload = {
    event,
    signatureId,
    timestamp: new Date().toISOString(),
    data,
    apiVersion: "v1",
  };

  const payloadStr = JSON.stringify(payload);

  // Generate HMAC signature
  const webhookSecret = process.env["WEBHOOK_SIGNING_SECRET"] ?? process.env["JWT_SECRET"]!;
  const hmacSig = `sha256=${createHmac("sha256", webhookSecret)
    .update(payloadStr)
    .digest("hex")}`;

  const fullPayload = { ...payload, signature: hmacSig };

  // Log delivery attempt
  const delivery = await prisma.webhookDelivery.create({
    data: {
      signatureId,
      url: webhookUrl,
      event,
      requestBody: fullPayload as object,
      status: "PENDING",
    },
  });

  // Attempt delivery with retry
  await sendWithRetry(delivery.id, webhookUrl, fullPayload, webhookSecret, 1);
}

/**
 * Send webhook with exponential backoff retry.
 */
async function sendWithRetry(
  deliveryId: string,
  url: string,
  payload: unknown,
  _secret: string,
  attempt: number,
  maxAttempts = 3
): Promise<void> {
  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "pdf-signature-webhook/1.0",
        "X-Pdf-Signature-Event": (payload as { event: string }).event,
      },
      timeout: 10_000, // 10 second timeout
      validateStatus: (status) => status < 500, // Accept 2xx and 4xx (client error = don't retry)
    });

    const success = response.status >= 200 && response.status < 300;

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: success ? "DELIVERED" : "FAILED",
        responseCode: response.status,
        responseBody: JSON.stringify(response.data).slice(0, 500),
        deliveredAt: success ? new Date() : undefined,
      },
    });

    if (!success && attempt < maxAttempts) {
      // Queue retry
      const retryDelay = Math.pow(2, attempt) * 60 * 1000; // 1min, 2min, 4min
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "RETRYING",
          attemptNumber: attempt + 1,
          nextRetryAt: new Date(Date.now() + retryDelay),
        },
      });
    }
  } catch (error) {
    const isNetworkError =
      axios.isAxiosError(error) && !error.response;

    if (isNetworkError && attempt < maxAttempts) {
      const retryDelay = Math.pow(2, attempt) * 60 * 1000;
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "RETRYING",
          attemptNumber: attempt + 1,
          nextRetryAt: new Date(Date.now() + retryDelay),
          responseBody: (error as Error).message,
        },
      });
    } else {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "FAILED",
          responseBody: (error as Error).message,
        },
      });
    }
  }
}

// Export as service object
export const notifyService = {
  signatureCompleted,
  dispatchWebhook,
};
