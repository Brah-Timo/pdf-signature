/**
 * pdf-signature — HTTP Client
 * Wraps axios with retry logic, auth headers, and error normalization.
 */

import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
} from "axios";
import { getConfig } from "./config.js";
import {
  AuthenticationError,
  QuotaExceededError,
  RateLimitError,
  PdfSignatureError,
  ValidationError,
} from "./types.js";

/** Create a pre-configured axios instance */
function createAxiosInstance(): AxiosInstance {
  const config = getConfig();

  const instance = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: config.timeout,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "X-SDK-Version": "1.0.0",
      "X-SDK-Language": "typescript",
    },
  });

  // Request interceptor — debug logging
  instance.interceptors.request.use((req) => {
    if (config.debug) {
      console.debug(`[pdf-signature] → ${req.method?.toUpperCase()} ${req.url}`);
    }
    return req;
  });

  // Response interceptor — error normalization
  instance.interceptors.response.use(
    (res) => {
      if (config.debug) {
        console.debug(`[pdf-signature] ← ${res.status} ${res.config.url}`);
      }
      return res;
    },
    (error: AxiosError) => {
      throw normalizeApiError(error);
    }
  );

  return instance;
}

/** Convert raw HTTP errors into typed sdk errors */
function normalizeApiError(error: AxiosError): PdfSignatureError {
  if (!error.response) {
    return new PdfSignatureError(
      `Network error: ${error.message}`,
      "NETWORK_ERROR"
    );
  }

  const { status, data } = error.response as {
    status: number;
    data: { error?: string; message?: string; field?: string };
  };

  switch (status) {
    case 400:
      return new ValidationError(
        data?.error ?? data?.message ?? "Bad request",
        data?.field
      );
    case 401:
    case 403:
      return new AuthenticationError(
        data?.error ?? "Authentication failed"
      );
    case 402:
      return new QuotaExceededError();
    case 429: {
      const retryAfter = Number(
        (error.response.headers as Record<string, string>)["retry-after"] ?? 60
      );
      return new RateLimitError(retryAfter);
    }
    default:
      return new PdfSignatureError(
        data?.error ?? data?.message ?? `HTTP ${status} error`,
        `HTTP_${status}`,
        status
      );
  }
}

/**
 * Execute an HTTP request with automatic retry on transient failures.
 * Retries on: network errors, 429 (rate limit), 5xx server errors.
 * Does NOT retry on: 4xx client errors (except 429).
 */
export async function httpRequest<T>(
  reqConfig: AxiosRequestConfig
): Promise<T> {
  const config = getConfig();
  const client = createAxiosInstance();
  let lastError: PdfSignatureError | null = null;

  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    try {
      const response = await client.request<T>(reqConfig);
      return response.data;
    } catch (err) {
      if (!(err instanceof PdfSignatureError)) throw err;
      lastError = err;

      const isRetryable =
        err.code === "NETWORK_ERROR" ||
        err.code === "RATE_LIMIT_EXCEEDED" ||
        (err.statusCode !== undefined && err.statusCode >= 500);

      if (!isRetryable || attempt >= config.retryAttempts) {
        throw err;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      if (config.debug) {
        console.debug(
          `[pdf-signature] Retrying (attempt ${attempt}/${config.retryAttempts}) after ${delayMs}ms...`
        );
      }
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// Helper: Prepare file for upload
// ─────────────────────────────────────────────

/**
 * Convert a file path, Buffer, or Uint8Array to base64.
 * Validates that the data looks like a PDF (starts with %PDF).
 */
export async function preparePdfPayload(
  source: string | Buffer | Uint8Array
): Promise<{ base64: string; mimeType: "application/pdf"; fileName: string }> {
  let buffer: Buffer;
  let fileName = "document.pdf";

  if (typeof source === "string") {
    // File path — dynamic import to avoid bundling 'fs' in browser
    const fs = await import("fs/promises");
    const path = await import("path");
    buffer = await fs.readFile(source);
    fileName = path.basename(source);
  } else if (Buffer.isBuffer(source)) {
    buffer = source;
  } else {
    buffer = Buffer.from(source);
  }

  // Validate PDF magic bytes: %PDF
  if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
    throw new Error(
      "The provided file does not appear to be a valid PDF. " +
      "Expected file starting with '%PDF'."
    );
  }

  return {
    base64: buffer.toString("base64"),
    mimeType: "application/pdf",
    fileName,
  };
}
